/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import "dotenv/config";
import express from "express";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcrypt";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createServer as createViteServer } from "vite";
import { dbStore, waitForDbReady } from "./server/db.js";
import { Role, UserStatus } from "./src/types/index.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  deliverFormattedNotification,
  validateUpload,
} from "./server/integrations.js";

// ─── Startup environment guard ────────

const REQUIRED_ENV_VARS = ["APP_URL"] as const;
for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    console.error(`[FATAL] Missing required environment variable: ${key}. Exiting.`);
    process.exit(1);
  }
}

const BCRYPT_ROUNDS = 12;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CLOUDINARY_FOLDER = "projectflow_workspace";

// SETUP_TOKEN guard.
const SETUP_TOKEN = process.env.SETUP_TOKEN;
if (!SETUP_TOKEN) {
  console.warn(
    "[WARN] SETUP_TOKEN is not set. Initial workspace bootstrap is DISABLED until this " +
    "variable is defined. Set SETUP_TOKEN=<secure-random-value> in your .env file."
  );
}

// CORS allowlist — comma-separated origins in env, falls back to APP_URL.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.APP_URL || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// ─── Password hashing ──────
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const isLegacySha256 = /^[a-f0-9]{64}$/i.test(stored);
  if (isLegacySha256) {
    const legacyHash = crypto.createHash("sha256").update(password).digest();
    const storedBuf = Buffer.from(stored, "hex");
    if (legacyHash.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(legacyHash, storedBuf);
  }
  return bcrypt.compare(password, stored);
}

// ─── Session tokens ─────
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function createSessionForUser(userId: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await dbStore.createSession(token, userId, expiresAt);
  return token;
}

function isAdminRole(role: Role): boolean {
  return role === Role.SUPER_ADMIN || role === Role.ADMIN;
}

function isManagerRole(role: Role): boolean {
  return role === Role.SUPER_ADMIN || role === Role.ADMIN || role === Role.PROJECT_MANAGER;
}

// CSV field escaping — wraps in quotes and doubles internal quotes; also
// neutralizes leading =,+,-,@ to defeat formula/CSV injection in Excel/Sheets.
function csvField(value: string): string {
  let v = String(value ?? "");
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  return `"${v.replace(/"/g, '""')}"`;
}

async function startServer() {
  await waitForDbReady();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Add Helmet for security headers (X-Content-Type-Options,
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    })
  );

  // Separate body-size limits.
  app.use((req, res, next) => {
    if (req.path === "/api/cloudinary/upload") {
      express.json({ limit: "15mb" })(req, res, next);
    } else {
      express.json({ limit: "256kb" })(req, res, next);
    }
  });

  // General API rate limiter
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api", apiLimiter);

  // Tight limiter for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." },
  });

  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "AI generation rate limit reached. Please try again later." },
  });
  
  const inviteValidateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many validation attempts. Please try again later." },
  });

  // ─── Auth middleware ──────
  const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized. Missing token." });
      return;
    }
    const token = authHeader.split(" ")[1];
    const session = await dbStore.getSession(token);
    if (!session || new Date(session.expiresAt) < new Date()) {
      if (session) await dbStore.deleteSession(token);
      res.status(401).json({ error: "Session expired or invalid. Please sign in again." });
      return;
    }
    const user = await dbStore.getUserById(session.userId);
    if (!user) {
      res.status(401).json({ error: "Session expired or user not found." });
      return;
    }
    if (user.status !== UserStatus.APPROVED) {
      res.status(403).json({ error: `Access Denied. Your account is currently ${user.status}.` });
      return;
    }
    (req as any).user = user;
    (req as any).sessionToken = token;
    next();
  };

  const canManageProject = (caller: any, project: any): boolean => {
    if (isManagerRole(caller.role)) return true;
    if (project.ownerId === caller.id) return true;
    return false;
  };

  // Separate read-access check (member OR manager).
  // Used for read-only operations where members should be able to view data.
  const isMemberOrManager = (caller: any, project: any): boolean => {
    if (isManagerRole(caller.role)) return true;
    if (project.ownerId === caller.id) return true;
    if (Array.isArray(project.members) && project.members.includes(caller.id)) return true;
    return false;
  };

  // --- API ROUTES ---

  // ─── Auth ─────
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    const { name, username, email, password, isInvitation, inviteToken, role, teamId } = req.body;
    if (!name || !username || !email || !password) {
      res.status(400).json({ error: "All fields are required." });
      return;
    }
    if (typeof password !== "string" || password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters." });
      return;
    }

    const existing = await dbStore.getUserByUsernameOrEmail(username) || await dbStore.getUserByUsernameOrEmail(email);
    if (existing) {
      res.status(400).json({ error: "Username or email already exists." });
      return;
    }

    let resolvedRole: Role | undefined;
    let resolvedTeamId: string | undefined;
    let resolvedAutoApprove = false;
    let invite: any = null;

    if (inviteToken) {
      invite = await dbStore.getInvitationById(inviteToken);
      if (!invite || invite.status !== "active") {
        res.status(400).json({ error: "Invitation is invalid, expired, or already used up." });
        return;
      }
      resolvedRole = invite.role;
      resolvedTeamId = invite.teamId;
      resolvedAutoApprove = true;
    }

    const existingUsersCount = (await dbStore.getUsers()).length;
    let bootstrapSuperAdmin = false;
    if (existingUsersCount === 0) {
      const providedToken = typeof req.body.setupToken === "string" ? req.body.setupToken : "";
      const expectedToken = SETUP_TOKEN ?? "";
      const tokensMatch =
        expectedToken.length > 0 &&
        providedToken.length === expectedToken.length &&
        crypto.timingSafeEqual(Buffer.from(providedToken), Buffer.from(expectedToken));

      if (!tokensMatch) {
        res.status(403).json({
          error: "Initial workspace setup requires a valid setup token. Contact your administrator.",
        });
        return;
      }
      bootstrapSuperAdmin = true;
    }

    const passwordHash = await hashPassword(password);
    const user = await dbStore.createUser({
      name,
      username,
      email,
      passwordHash,
      role: bootstrapSuperAdmin
        ? Role.SUPER_ADMIN
        : resolvedRole ?? (isInvitation ? (role || Role.JUNIOR) : Role.JUNIOR),
      status: bootstrapSuperAdmin || resolvedAutoApprove ? UserStatus.APPROVED : UserStatus.PENDING,
      teamId: resolvedTeamId ?? (isInvitation ? (teamId || undefined) : undefined),
    });

    if (invite) {
      await dbStore.useInvitation(invite.id);
    }

    const isAutoApproved = user.status === UserStatus.APPROVED;

    res.status(201).json({
      message: isAutoApproved
        ? "Registration completed successfully! Your account is active and you can sign in."
        : "Registration successful. Please wait for an administrator to approve your account.",
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      res.status(400).json({ error: "Username/Email and Password are required." });
      return;
    }

    const user = await dbStore.getUserByUsernameOrEmail(usernameOrEmail);
    const compareTarget = (user as any)?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinv";
    const passwordOk = await verifyPassword(password, compareTarget);

    if (!user || !passwordOk) {
      res.status(400).json({ error: "Invalid username, email, or password." });
      return;
    }

    if (user.status !== UserStatus.APPROVED) {
      res.status(403).json({ error: `Your account is ${user.status}. Please contact an administrator.` });
      return;
    }

    if (/^[a-f0-9]{64}$/i.test((user as any).passwordHash)) {
      const upgraded = await hashPassword(password);
      await dbStore.updateUserPasswordHash?.(user.id, upgraded);
    }

    const token = await createSessionForUser(user.id);

    res.json({ message: "Login successful.", token, user });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      await dbStore.deleteSession(authHeader.split(" ")[1]);
    }
    res.json({ success: true });
  });

  app.get("/api/auth/session", authenticateUser, async (req, res) => {
    res.json({ user: (req as any).user });
  });

  // ─── Users ─────
  app.get("/api/users", authenticateUser, async (req, res) => {
    const users = await dbStore.getUsers();
    res.json(users.map(u => ({
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      teamId: u.teamId,
      createdAt: u.createdAt,
    })));
  });

  app.put("/api/users/:id/status", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    if (!isManagerRole(caller.role)) {
      res.status(403).json({ error: "Only Admins or Project Managers can approve accounts." });
      return;
    }
    const { status } = req.body;
    if (!status || !Object.values(UserStatus).includes(status)) {
      res.status(400).json({ error: "Invalid user status." });
      return;
    }
    const updated = await dbStore.updateUserStatus(req.params.id, status);
    if (!updated) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    await dbStore.createNotification(
      req.params.id,
      "approval",
      `Your account status has been updated to ${status} by ${caller.name}.`
    );

    if (updated.email) {
      try {
        await deliverFormattedNotification({
          recipientName: updated.name,
          recipientEmail: updated.email,
          subject: `Workspace Profile Update: ${status}`,
          heading: `Account Status Update`,
          message: `Your ProjectFlow portal account registration status has been updated to "${status}" by workspace moderator ${caller.name}.`,
          actionLabel: "Access Workspace Dashboard",
          actionUrl: `${process.env.APP_URL || "http://localhost:3000"}`,
          metaDetails: [
            { label: "Account Username", value: updated.username },
            { label: "Profile Status", value: updated.status },
            { label: "Assigned Work Role", value: updated.role },
          ],
        });
      } catch (e) {
        console.error("[EMAIL] status-update notification failed:", e);
      }
    }

    res.json({ success: true, user: updated });
  });

  app.put("/api/users/:id/details", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    if (!isManagerRole(caller.role) && caller.id !== req.params.id) {
      res.status(403).json({ error: "You don't have permission to edit this user." });
      return;
    }
    const { role, teamId } = req.body;
    const userElem = await dbStore.getUserById(req.params.id);
    if (!userElem) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    if (role && Object.values(Role).includes(role)) {
      if (!isManagerRole(caller.role)) {
        res.status(403).json({ error: "Only Admins or Project Managers can change roles." });
        return;
      }
      await dbStore.updateUserRole(req.params.id, role);
    }
    await dbStore.updateUserTeam(req.params.id, teamId === "none" ? undefined : (teamId || undefined));

    const updated = await dbStore.getUserById(req.params.id);
    res.json({ success: true, user: updated });
  });

  app.put("/api/users/:id/role", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    if (!isAdminRole(caller.role)) {
      res.status(403).json({ error: "Only administrators can assign roles." });
      return;
    }
    const { role } = req.body;
    if (!role || !Object.values(Role).includes(role)) {
      res.status(400).json({ error: "Invalid user role." });
      return;
    }
    const updated = await dbStore.updateUserRole(req.params.id, role);
    if (!updated) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    await dbStore.createNotification(
      req.params.id,
      "approval",
      `Your core role has been updated to ${role} by Administrator ${caller.name}.`
    );

    if (updated.email) {
      try {
        await deliverFormattedNotification({
          recipientName: updated.name,
          recipientEmail: updated.email,
          subject: `Workspace Promotion: ${role}`,
          heading: `Assigned Role Elevation`,
          message: `Your ProjectFlow authority has been elevated to "${role}" by administrator ${caller.name}.`,
          actionLabel: "Launch Developer Console",
          actionUrl: `${process.env.APP_URL || "http://localhost:3000"}`,
          metaDetails: [
            { label: "Designated Role", value: updated.role },
            { label: "Promotion Date", value: new Date().toLocaleDateString() },
          ],
        });
      } catch (e) {
        console.error("[EMAIL] role-update notification failed:", e);
      }
    }

    res.json({ success: true, user: updated });
  });

  // ─── Projects ──────
  app.get("/api/projects", authenticateUser, async (req, res) => {
    const projects = await dbStore.getProjects();
    res.json(projects);
  });

  app.get("/api/projects/:id", authenticateUser, async (req, res) => {
    const project = await dbStore.getProjectById(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json(project);
  });

  app.post("/api/projects", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    const { name, richTextDescription, status, priority, startDate, endDate, coverImageUrl, tags, members } = req.body;
    if (!name || !richTextDescription || !startDate || !endDate) {
      res.status(400).json({ error: "Name, description, start and end dates are required." });
      return;
    }

    const project = await dbStore.createProject({
      name,
      richTextDescription,
      status: status || "Planning",
      priority: priority || "Low",
      startDate,
      endDate,
      coverImageUrl,
      ownerId: caller.id,
      tags: tags || [],
      members: members || [caller.id],
    });

    await dbStore.createActivity(project.id, caller.id, caller.name, "project_created", `Created project: "${project.name}"`);

    for (const mId of project.members) {
      if (mId !== caller.id) {
        await dbStore.createNotification(mId, "assignment", `You have been added to the project: ${project.name}`, project.id);
        const memberUser = await dbStore.getUserById(mId);
        if (memberUser && memberUser.email) {
          try {
            await deliverFormattedNotification({
              recipientName: memberUser.name,
              recipientEmail: memberUser.email,
              subject: `Project Assignment Invitation: ${project.name}`,
              heading: `Added to New Project Board`,
              message: `You have been added as a core project member / engineer under the team board "${project.name}".`,
              actionLabel: "Access Project Board",
              actionUrl: `${process.env.APP_URL || "http://localhost:3000"}`,
              metaDetails: [
                { label: "Project Title", value: project.name },
                { label: "Strategic Priority", value: project.priority },
                { label: "Target Timeline", value: `${project.startDate} to ${project.endDate}` },
              ],
            });
          } catch (e) {
            console.error("[EMAIL] project-assignment notification failed:", e);
          }
        }
      }
    }

    res.status(201).json(project);
  });

  app.put("/api/projects/:id", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    const project = await dbStore.getProjectById(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    if (!canManageProject(caller, project)) {
      res.status(403).json({ error: "You don't have permission to edit this project." });
      return;
    }

    if (
      req.body.coverImageUrl &&
      project.coverImageUrl &&
      req.body.coverImageUrl !== project.coverImageUrl &&
      project.coverImageUrl.includes(`/${CLOUDINARY_FOLDER}/`)
    ) {
      await deleteFromCloudinary(project.coverImageUrl);
    }

    const updated = await dbStore.updateProject(req.params.id, req.body);
    if (updated) {
      await dbStore.createActivity(req.params.id, caller.id, caller.name, "project_updated", `Updated project settings / details`);
    }
    res.json(updated);
  });

  app.delete("/api/projects/:id", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    const project = await dbStore.getProjectById(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    if (!canManageProject(caller, project)) {
      res.status(403).json({ error: "You don't have permission to delete this project." });
      return;
    }

    await dbStore.deleteProject(req.params.id);
    await dbStore.createActivity(req.params.id, caller.id, caller.name, "project_trashed", `Moved project "${project.name}" to Trash box`);
    res.json({ success: true, message: "Project and tasks sheets moved to Trash box (will be deleted permanently in 15 days)." });
  });

  // Mentions autocomplete
  app.get("/api/projects/:id/mentionable", authenticateUser, async (req, res) => {
    const q = (req.query.q || "").toString().toLowerCase();
    const project = await dbStore.getProjectById(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const allUsers = (await dbStore.getUsers()).filter(u => u.status === UserStatus.APPROVED);
    const projectUsers = allUsers.filter(u => project.members.includes(u.id));
    const teams = await dbStore.getTeams();

    const filteredUsers = projectUsers.filter(u =>
      u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );

    const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(q));

    res.json({
      users: filteredUsers.map(u => ({ id: u.id, name: u.name, username: u.username, email: u.email })),
      teams: filteredTeams.map(t => ({ id: t.id, name: t.name, description: t.description })),
    });
  });

  // CSV Hour Tracking Export
  app.get("/api/projects/:id/hours/export", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    const project = await dbStore.getProjectById(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    if (!canManageProject(caller, project)) {
      res.status(403).json({ error: "You don't have permission to export this project's hours." });
      return;
    }

    const tasks = await dbStore.getTasks(project.id);
    const users = await dbStore.getUsers();

    let csvContent = "Task Title,Category,Worker,Hours,Manual/Tracked,Logged At,Note\n";

    tasks.forEach(task => {
      task.timeLogs.forEach(log => {
        const worker = users.find(u => u.id === log.userId)?.name || "Unknown";
        const loggedDate = log.createdAt ? log.createdAt.split("T")[0] : "";
        const trackingType = log.startTime ? "Tracked Interval" : "Manual";
        csvContent += [
          csvField(task.title),
          csvField(task.category),
          csvField(worker),
          csvField(String(log.hours)),
          csvField(trackingType),
          csvField(loggedDate),
          csvField(log.note || ""),
        ].join(",") + "\n";
      });
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=project_${project.id}_hours.csv`);
    res.status(200).send(csvContent);
  });

  // ─── Tasks ───────────────────────────────────────────────────────────────────
  app.get("/api/tasks", authenticateUser, async (req, res) => {
    const { projectId } = req.query;
    const tasks = await dbStore.getTasks(projectId ? String(projectId) : undefined);

    const projectIds = [...new Set(tasks.map(t => t.projectId))];
    const projectMap: Record<string, string> = {};
    await Promise.all(
      projectIds.map(async id => {
        const proj = await dbStore.getProjectById(id);
        projectMap[id] = proj ? proj.name : "Unknown Project";
      })
    );

    res.json(tasks.map(t => ({ ...t, projectName: projectMap[t.projectId] ?? "Unknown Project" })));
  });

  app.get("/api/tasks/:id", authenticateUser, async (req, res) => {
    const task = await dbStore.getTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: "Task not found." });
      return;
    }
    const proj = await dbStore.getProjectById(task.projectId);
    res.json({ ...task, projectName: proj ? proj.name : "Unknown Project" });
  });

  app.post("/api/tasks", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    const { projectId, title, richTextDesc, status, priority, category, dueDate, estimatedHours, assignees, dependencies } = req.body;
    if (!projectId || !title || !category || !dueDate) {
      res.status(400).json({ error: "ProjectId, title, category, and due date are required." });
      return;
    }

    const project = await dbStore.getProjectById(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    if (!canManageProject(caller, project)) {
      res.status(403).json({ error: "You don't have permission to add tasks to this project." });
      return;
    }

    const cleanAssignees: { userId?: string; teamId?: string }[] = [];
    if (Array.isArray(assignees)) {
      for (const a of assignees) {
        if (a.userId) {
          const u = await dbStore.getUserById(a.userId);
          if (u) cleanAssignees.push({ userId: u.id });
        } else if (a.teamId) {
          const t = await dbStore.getTeamById(a.teamId);
          if (t) cleanAssignees.push({ teamId: t.id });
        }
      }
    }

    let cleanDependencies: string[] = [];
    if (Array.isArray(dependencies) && dependencies.length > 0) {
      const projectTasks = await dbStore.getTasks(projectId, true);
      const validIds = new Set(projectTasks.map(t => t.id));
      cleanDependencies = dependencies.filter((d: string) => validIds.has(d));
    }

    const task = await dbStore.createTask({
      projectId,
      title,
      richTextDesc: richTextDesc || "",
      status: status || "To Do",
      priority: priority || "Medium",
      category,
      dueDate,
      estimatedHours: Number(estimatedHours) || 0,
      assignees: cleanAssignees,
      dependencies: cleanDependencies,
    });

    const allUsers = await dbStore.getUsers();

    for (const asn of task.assignees) {
      if (asn.userId) {
        await dbStore.createNotification(
          asn.userId,
          "assignment",
          `You have been assigned to task: "${task.title}" in project "${project.name}"`,
          project.id
        );
        const memberUser = allUsers.find(u => u.id === asn.userId);
        if (memberUser && memberUser.email) {
          try {
            await deliverFormattedNotification({
              recipientName: memberUser.name,
              recipientEmail: memberUser.email,
              subject: `New Task Assignment: ${task.title}`,
              heading: `You Have Been Assigned a Task`,
              message: `Hello, you have been assigned to the task "${task.title}" under project "${project.name}".`,
              actionLabel: "View Assignment Boards",
              actionUrl: `${process.env.APP_URL || "http://localhost:3000"}`,
              metaDetails: [
                { label: "Task Work", value: task.title },
                { label: "Work Category", value: task.category },
                { label: "Specified Due Date", value: task.dueDate },
                { label: "Target Workspace Duration", value: `${task.estimatedHours} Hours` },
              ],
            });
          } catch (e) {
            console.error("[EMAIL] task-assignment notification failed:", e);
          }
        }
      } else if (asn.teamId) {
        const teamMembers = allUsers.filter(u => u.teamId === asn.teamId);
        for (const u of teamMembers) {
          await dbStore.createNotification(
            u.id,
            "assignment",
            `Your team has been assigned task: "${task.title}" in "${project.name}"`,
            project.id
          );
          if (u.email) {
            try {
              await deliverFormattedNotification({
                recipientName: u.name,
                recipientEmail: u.email,
                subject: `Team Task Assigned: ${task.title}`,
                heading: `Assigned Squad Task Alert`,
                message: `Your professional squad has been assigned task item "${task.title}" under project board "${project.name}".`,
                actionLabel: "Inspect Board Details",
                actionUrl: `${process.env.APP_URL || "http://localhost:3000"}`,
                metaDetails: [
                  { label: "Task Header", value: task.title },
                  { label: "Squad Allocation", value: "Assigned Squad" },
                  { label: "Due Date", value: task.dueDate },
                ],
              });
            } catch (e) {
              console.error("[EMAIL] team-task notification failed:", e);
            }
          }
        }
      }
    }

    await dbStore.createActivity(task.projectId, caller.id, caller.name, "task_created", `Created task: "${task.title}" (Priority: ${task.priority})`);

    res.status(201).json(task);
  });

  app.put("/api/tasks/:id", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    const task = await dbStore.getTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const project = await dbStore.getProjectById(task.projectId);
    if (!project || !canManageProject(caller, project)) {
      res.status(403).json({ error: "You don't have permission to edit this task." });
      return;
    }

    if (req.body.status === "Done") {
      if (task.dependencies && task.dependencies.length > 0) {
        const projectTasks = await dbStore.getTasks(task.projectId);
        const incompleteDeps = projectTasks.filter(t =>
          task.dependencies!.includes(t.id) &&
          t.status !== "Done" &&
          !t.deleted
        );
        if (incompleteDeps.length > 0) {
          res.status(400).json({
            error: `Cannot set to Done. Blocked by unfinished dependencies: ${incompleteDeps.map(t => `"${t.title}"`).join(", ")}`,
          });
          return;
        }
      }
    }

    const patch = { ...req.body };
    if (Array.isArray(patch.assignees)) {
      const cleanAssignees: { userId?: string; teamId?: string }[] = [];
      for (const a of patch.assignees) {
        if (a.userId) {
          const u = await dbStore.getUserById(a.userId);
          if (u) cleanAssignees.push({ userId: u.id });
        } else if (a.teamId) {
          const t = await dbStore.getTeamById(a.teamId);
          if (t) cleanAssignees.push({ teamId: t.id });
        }
      }
      patch.assignees = cleanAssignees;
    }
    if (Array.isArray(patch.dependencies)) {
      const projectTasks = await dbStore.getTasks(task.projectId, true);
      const validIds = new Set(projectTasks.filter(t => t.id !== task.id).map(t => t.id));
      patch.dependencies = patch.dependencies.filter((d: string) => validIds.has(d));
    }

    const originalStatus = task.status;
    const updated = await dbStore.updateTask(req.params.id, patch);

    if (updated) {
      if (originalStatus !== updated.status) {
        await dbStore.createActivity(updated.projectId, caller.id, caller.name, "task_moved", `Moved task "${updated.title}" from "${originalStatus}" to "${updated.status}"`);
      } else {
        await dbStore.createActivity(updated.projectId, caller.id, caller.name, "task_updated", `Updated task "${updated.title}"`);
      }
    }

    if (updated && originalStatus !== "Done" && updated.status === "Done") {
      const owner = project ? await dbStore.getUserById(project.ownerId) : null;

      if (owner) {
        await dbStore.createNotification(
          owner.id,
          "status_change",
          `Task "${updated.title}" has been completed/marked as Done!`,
          project?.id
        );
        if (owner.email) {
          try {
            await deliverFormattedNotification({
              recipientName: owner.name,
              recipientEmail: owner.email,
              subject: `Task Finished Checklist: ${updated.title}`,
              heading: `Task Completed Successfully`,
              message: `Good news! Your project task listed under "${updated.title}" in project board "${project?.name}" has been completed/marked as Done.`,
              actionLabel: "Access Workspace Board",
              actionUrl: `${process.env.APP_URL || "http://localhost:3000"}`,
              metaDetails: [
                { label: "Completed Task name", value: updated.title },
                { label: "Source Project Board", value: project?.name || "Unknown project" },
                { label: "Delivery Date", value: new Date().toLocaleDateString() },
              ],
            });
          } catch (e) {
            console.error("[EMAIL] task-completed (owner) notification failed:", e);
          }
        }
      }

      for (const asn of updated.assignees) {
        if (asn.userId && asn.userId !== (owner ? owner.id : "")) {
          const assignee = await dbStore.getUserById(asn.userId);
          if (assignee && assignee.email) {
            try {
              await deliverFormattedNotification({
                recipientName: assignee.name,
                recipientEmail: assignee.email,
                subject: `Completed Task Broadcast: ${updated.title}`,
                heading: `Assigned Task Accomplished`,
                message: `Your assigned task item "${updated.title}" has been successfully archived as Completed.`,
                actionLabel: "Revisit Project Dashboard",
                actionUrl: `${process.env.APP_URL || "http://localhost:3000"}`,
                metaDetails: [
                  { label: "Closed task name", value: updated.title },
                  { label: "Parent Board", value: project?.name || "Unknown project" },
                ],
              });
            } catch (e) {
              console.error("[EMAIL] task-completed (assignee) notification failed:", e);
            }
          }
        }
      }
    }

    res.json(updated);
  });

  app.delete("/api/tasks/:id", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    const task = await dbStore.getTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: "Task not found." });
      return;
    }

    const project = await dbStore.getProjectById(task.projectId);
    if (!project || !canManageProject(caller, project)) {
      res.status(403).json({ error: "You don't have permission to delete this task." });
      return;
    }

    await dbStore.deleteTask(req.params.id);
    await dbStore.createActivity(task.projectId, caller.id, caller.name, "task_trashed", `Moved task "${task.title}" to Trash box`);
    res.json({ success: true, message: "Task moved to Trash box (will be deleted permanently in 15 days)." });
  });

  app.post("/api/tasks/:id/log-hours", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    const { hours, note, startTime, endTime } = req.body;
    if (!hours || Number(hours) <= 0) {
      res.status(400).json({ error: "Valid hours log is required." });
      return;
    }

    const task = await dbStore.getTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const log = await dbStore.addTaskLog(req.params.id, {
      userId: caller.id,
      hours: Number(hours),
      note: note || "",
      startTime,
      endTime,
    });

    res.status(201).json({ success: true, log });
  });

  // ─── Comments ─────
  app.get("/api/comments", authenticateUser, async (req, res) => {
    const { taskId } = req.query;
    if (!taskId) {
      res.status(400).json({ error: "TaskId is required." });
      return;
    }
    const comments = await dbStore.getComments(String(taskId));
    res.json(comments);
  });

  app.post("/api/comments", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    const { taskId, content } = req.body;
    if (!taskId || !content) {
      res.status(400).json({ error: "TaskId and rich comment content are required." });
      return;
    }

    const comment = await dbStore.createComment(taskId, caller.id, content);

    const taskObj = await dbStore.getTaskById(taskId);
    if (taskObj) {
      const strippedContent = content.replace(/<[^>]*>/g, "").substring(0, 60);
      await dbStore.createActivity(taskObj.projectId, caller.id, caller.name, "comment_added", `Commented on task "${taskObj.title}": "${strippedContent}..."`);
    }

    res.status(201).json(comment);
  });

  app.put("/api/comments/:id", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    const { content } = req.body;
    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "Comment content is required." });
      return;
    }

    const existing = await dbStore.getCommentById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Comment not found." });
      return;
    }
    if (existing.userId !== caller.id && !isAdminRole(caller.role)) {
      res.status(403).json({ error: "You can only edit your own comments." });
      return;
    }

    const updated = await dbStore.updateComment(req.params.id, content);
    res.json(updated);
  });

  // ─── Teams ─────
  app.get("/api/teams", authenticateUser, async (req, res) => {
    const teamsList = await dbStore.getTeams();
    const allUsers = await dbStore.getUsers();
    const resolvedTeams = teamsList.map(t => ({
      ...t,
      membersCount: allUsers.filter(u => u.teamId === t.id).length,
    }));
    res.json(resolvedTeams);
  });

  app.post("/api/teams", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    if (!isManagerRole(caller.role)) {
      res.status(403).json({ error: "Only Admins or Project Managers can create teams." });
      return;
    }
    const { name, description, leadId } = req.body;
    if (!name || !leadId) {
      res.status(400).json({ error: "Team name and team lead assignment are required." });
      return;
    }

    const team = await dbStore.createTeam(name, description || "", leadId);
    res.status(201).json(team);
  });

  app.put("/api/teams/:id", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    if (!isManagerRole(caller.role)) {
      res.status(403).json({ error: "Access Denied. Only workspace administrators or project managers can edit teams." });
      return;
    }

    const team = await dbStore.getTeamById(req.params.id);
    if (!team) {
      res.status(404).json({ error: "Team not found." });
      return;
    }

    const { name, description, leadId } = req.body;
    const updated = await dbStore.updateTeam(req.params.id, {
      ...(name ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(leadId ? { leadId } : {}),
    });

    res.json(updated);
  });

  app.delete("/api/teams/:id", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    if (!isManagerRole(caller.role)) {
      res.status(403).json({ error: "Access Denied. Only workspace administrators or project managers can disband teams." });
      return;
    }
    await dbStore.deleteTeam(req.params.id);
    res.json({ success: true });
  });

  // ─── Invitations ──────
  app.get("/api/invitations", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    if (!isManagerRole(caller.role)) {
      res.status(403).json({ error: "Only Admins or Project Managers can view invitations." });
      return;
    }
    const invitations = await dbStore.getInvitations();
    res.json(invitations);
  });

  app.post("/api/invitations", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    if (!isManagerRole(caller.role)) {
      res.status(403).json({ error: "Only Admins or Project Managers can create invitations." });
      return;
    }
    const { email, role, teamId, teamName, usedLimit, plan } = req.body;
    if (!role || !Object.values(Role).includes(role)) {
      res.status(400).json({ error: "A valid role is required." });
      return;
    }

    const safeUsedLimit =
      typeof usedLimit === "number" && Number.isFinite(usedLimit) && usedLimit >= 0
        ? Math.floor(usedLimit)
        : 1;

    const id = "inv_" + crypto.randomBytes(9).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const invitation = await dbStore.createInvitation({
      id,
      createdBy: caller.id,
      creatorName: caller.name,
      email: email || undefined,
      role,
      teamId: teamId || undefined,
      teamName: teamName || undefined,
      usedLimit: safeUsedLimit,
      plan: plan || "Free",
      expiresAt,
    } as any);

    res.status(201).json(invitation);
  });

  app.get("/api/invitations/validate/:token", inviteValidateLimiter, async (req, res) => {
    const invite = await dbStore.getInvitationById(req.params.token);
    if (!invite) {
      res.status(404).json({ valid: false, error: "Invitation not found." });
      return;
    }
    if (invite.status !== "active") {
      res.status(400).json({ valid: false, error: "Invitation is no longer valid.", reason: invite.status });
      return;
    }
    res.json({
      valid: true,
      invite: {
        role: invite.role,
        teamId: invite.teamId,
        teamName: invite.teamName,
        email: invite.email,
      },
    });
  });

  app.post("/api/invitations/:id/revoke", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    if (!isManagerRole(caller.role)) {
      res.status(403).json({ error: "Only Admins or Project Managers can revoke invitations." });
      return;
    }
    const ok = await dbStore.revokeInvitation(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Invitation not found." });
      return;
    }
    res.json({ success: true });
  });

  // ─── Notifications ────
  app.get("/api/notifications", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    const list = await dbStore.getNotifications(caller.id);
    res.json(list);
  });

  app.post("/api/notifications/read-all", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    await dbStore.markAllNotificationsAsRead(caller.id);
    res.json({ success: true });
  });

  app.put("/api/notifications/:id/read", authenticateUser, async (req, res) => {
    await dbStore.markNotificationAsRead(req.params.id);
    res.json({ success: true });
  });

  // ─── Cloudinary File Upload ─────
  app.post("/api/cloudinary/upload", authenticateUser, async (req, res) => {
    const { base64Data, filename, kind } = req.body;
    if (!base64Data || !filename) {
      res.status(400).json({ error: "base64Data and filename parameters are mandatory." });
      return;
    }

    const validation = validateUpload(base64Data, filename, kind);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }

    try {
      const result = await uploadToCloudinary(base64Data, filename, CLOUDINARY_FOLDER);
      res.status(201).json({ url: result.url, simulated: result.simulated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed uploading file image." });
    }
  });

  app.post("/api/cloudinary/delete", authenticateUser, async (req, res) => {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: "url is mandatory to clean up." });
      return;
    }
    if (!url.includes(`/${CLOUDINARY_FOLDER}/`)) {
      res.status(400).json({ error: "URL is not a managed ProjectFlow asset." });
      return;
    }

    try {
      const ok = await deleteFromCloudinary(url);
      res.status(200).json({ success: ok });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Cloudinary delete execution error." });
    }
  });

  // ─── File Attachments ─────
  app.post("/api/files/confirm", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    const { projectId, name, url, category } = req.body;
    if (!projectId || !name || !url) {
      res.status(400).json({ error: "Project, file name, and file link are required." });
      return;
    }

    const project = await dbStore.getProjectById(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    if (!canManageProject(caller, project)) {
      res.status(403).json({ error: "You don't have permission to attach files to this project." });
      return;
    }

    const fileItem = {
      id: "file_" + crypto.randomBytes(8).toString("hex"),
      name,
      url,
      category: category || "Specification",
      uploadedAt: new Date().toISOString(),
    };

    project.files.push(fileItem);
    await dbStore.updateProject(projectId, { files: project.files });

    await dbStore.createActivity(projectId, caller.id, caller.name, "file_uploaded", `Uploaded & registered document "${name}" under "${category || "Specification"}"`);

    res.status(201).json(fileItem);
  });

  // ─── Activities ────
  app.get("/api/projects/:id/activities", authenticateUser, async (req, res) => {
    try {
      const activities = await dbStore.getActivities(req.params.id);
      res.json(activities);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch activities." });
    }
  });

  // ─── Trash ────
  app.get("/api/trash", authenticateUser, async (req, res) => {
    try {
      const projects = await dbStore.getTrashedProjects();
      const tasks = await dbStore.getTrashedTasks();
      res.json({ projects, tasks });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch trash bin details." });
    }
  });

  app.post("/api/trash/restore/:type/:id", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    const { type, id } = req.params;
    try {
      if (type === "project") {
        const project = await dbStore.getProjectById(id);
        if (project && !canManageProject(caller, project)) {
          res.status(403).json({ error: "You don't have permission to restore this project." });
          return;
        }
        await dbStore.restoreProject(id);
        if (project) {
          await dbStore.createActivity(id, caller.id, caller.name, "project_restored", `Restored project "${project.name}" from Trash box`);
        }
        res.json({ success: true, message: "Project and assigned task cards restored successfully." });
      } else if (type === "task") {
        const task = await dbStore.getTaskById(id);
        if (task) {
          const project = await dbStore.getProjectById(task.projectId);
          if (project && !canManageProject(caller, project)) {
            res.status(403).json({ error: "You don't have permission to restore this task." });
            return;
          }
        }
        await dbStore.restoreTask(id);
        if (task) {
          await dbStore.createActivity(task.projectId, caller.id, caller.name, "task_restored", `Restored task "${task.title}" from Trash box`);
        }
        res.json({ success: true, message: "Task card restored successfully." });
      } else {
        res.status(400).json({ error: "Invalid entity type. Must be project or task." });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to restore target entity." });
    }
  });

  app.delete("/api/trash/delete/:type/:id", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    const { type, id } = req.params;
    try {
      if (type === "project") {
        const project = await dbStore.getProjectById(id);
        if (project && !canManageProject(caller, project)) {
          res.status(403).json({ error: "You don't have permission to permanently delete this project." });
          return;
        }
        if (project) {
          if (project.coverImageUrl?.includes(`/${CLOUDINARY_FOLDER}/`)) {
            await deleteFromCloudinary(project.coverImageUrl).catch(e => console.error("Cloudinary cover deletion error:", e));
          }
          if (project.files && project.files.length > 0) {
            for (const file of project.files) {
              if (file.url?.includes(`/${CLOUDINARY_FOLDER}/`)) {
                await deleteFromCloudinary(file.url).catch(e => console.error("Cloudinary file deletion error:", e));
              }
            }
          }
        }
        await dbStore.deleteProjectPermanent(id);
        res.json({ success: true, message: "Project and linked Cloudinary documents permanently deleted." });
      } else if (type === "task") {
        const task = await dbStore.getTaskById(id);
        if (task) {
          const project = await dbStore.getProjectById(task.projectId);
          if (project && !canManageProject(caller, project)) {
            res.status(403).json({ error: "You don't have permission to permanently delete this task." });
            return;
          }
        }
        await dbStore.deleteTaskPermanent(id);
        res.json({ success: true, message: "Task card and logged comments deleted permanently." });
      } else {
        res.status(400).json({ error: "Invalid entity type. Must be project or task." });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to permanently purge element." });
    }
  });

  // ─── Garbage Collection ────
  async function runTrashAutoCleanup() {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    console.log(`[GARBAGE COLLECTION] Scanning for items soft-deleted before ${fifteenDaysAgo.toISOString()}`);
    try {
      const trashedProjects = await dbStore.getTrashedProjects();
      for (const proj of trashedProjects) {
        if (proj.deletedAt && new Date(proj.deletedAt) < fifteenDaysAgo) {
          console.log(`[GARBAGE COLLECTION] Permanently purging project "${proj.name}" (ID: ${proj.id})`);
          if (proj.coverImageUrl?.includes(`/${CLOUDINARY_FOLDER}/`)) {
            await deleteFromCloudinary(proj.coverImageUrl).catch(e => console.error("[GC] Cloudinary cover delete failed:", e));
          }
          if (proj.files && proj.files.length > 0) {
            for (const f of proj.files) {
              if (f.url?.includes(`/${CLOUDINARY_FOLDER}/`)) {
                await deleteFromCloudinary(f.url).catch(e => console.error("[GC] Cloudinary file delete failed:", e));
              }
            }
          }
          await dbStore.deleteProjectPermanent(proj.id);
        }
      }

      const trashedTasks = await dbStore.getTrashedTasks();
      for (const t of trashedTasks) {
        if (t.deletedAt && new Date(t.deletedAt) < fifteenDaysAgo) {
          console.log(`[GARBAGE COLLECTION] Permanently purging task "${t.title}" (ID: ${t.id})`);
          await dbStore.deleteTaskPermanent(t.id);
        }
      }
    } catch (err) {
      console.error("[GARBAGE COLLECTION] Error inside periodic vacuum job:", err);
    }
  }

  // ─── AI Proxy ────
  app.post("/api/ai/generate", authenticateUser, aiLimiter, async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "A prompt string is required." });
      return;
    }
    if (prompt.length > 4000) {
      res.status(400).json({ error: "Prompt must be 4000 characters or fewer." });
      return;
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "AI generation is not configured on this server." });
      return;
    }
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      if (!r.ok) {
        res.status(502).json({ error: `AI provider error: ${r.status}` });
        return;
      }
      const data = await r.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      res.json({ text });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "AI generation failed." });
    }
  });

  // ─── Static / Vite ───────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ProjectFlow full-stack server running on http://localhost:${PORT}`);

    setTimeout(() => {
      runTrashAutoCleanup().catch(e => console.error("Initial cleanup pass failed:", e));
    }, 10000);

    setInterval(() => {
      runTrashAutoCleanup().catch(e => console.error("Periodic cleanup pass failed:", e));
    }, 30 * 60 * 1000);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});