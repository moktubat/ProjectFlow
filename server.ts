/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { dbStore } from "./server/db.js";
import { Role, UserStatus } from "./src/types/index.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  deliverFormattedNotification
} from "./server/integrations.js";

// Helper for hashing passwords
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Middleware to authenticate user from headers
  const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized. Missing token." });
      return;
    }
    const userId = authHeader.split(" ")[1];
    const user = await dbStore.getUserById(userId);
    if (!user) {
      res.status(401).json({ error: "Session expired or user not found." });
      return;
    }
    if (user.status !== UserStatus.APPROVED) {
      res.status(403).json({ error: `Access Denied. Your account is currently ${user.status}.` });
      return;
    }
    (req as any).user = user;
    next();
  };

  // --- API ROUTES FIRST ---

  // User Management Authentication
  app.post("/api/auth/register", async (req, res) => {
    const { name, username, email, password, isInvitation, role, teamId } = req.body;
    if (!name || !username || !email || !password) {
      res.status(400).json({ error: "All fields are required." });
      return;
    }

    const existing = await dbStore.getUserByUsernameOrEmail(username) || await dbStore.getUserByUsernameOrEmail(email);
    if (existing) {
      res.status(400).json({ error: "Username or email already exists." });
      return;
    }

    const passwordHash = hashPassword(password);
    const user = await dbStore.createUser({
      name,
      username,
      email,
      passwordHash,
      role: isInvitation ? (role || Role.JUNIOR) : Role.JUNIOR,
      status: isInvitation ? UserStatus.APPROVED : UserStatus.PENDING,
      teamId: isInvitation ? (teamId || undefined) : undefined
    });

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
        status: user.status
      }
    });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      res.status(400).json({ error: "Username/Email and Password are required." });
      return;
    }

    const user = await dbStore.getUserByUsernameOrEmail(usernameOrEmail);
    if (!user) {
      res.status(400).json({ error: "Invalid username, email, or password." });
      return;
    }

    const hash = hashPassword(password);
    if ((user as any).passwordHash !== hash) {
      res.status(400).json({ error: "Invalid username, email, or password." });
      return;
    }

    if (user.status !== UserStatus.APPROVED) {
      res.status(403).json({ error: `Your account is ${user.status}. Please contact an administrator.` });
      return;
    }

    res.json({
      message: "Login successful.",
      token: user.id,
      user
    });
  });

  app.get("/api/auth/session", authenticateUser, async (req, res) => {
    res.json({ user: (req as any).user });
  });

  // Approved users list and system users panel for Admins
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
      createdAt: u.createdAt
    })));
  });

  app.put("/api/users/:id/status", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    if (caller.role !== Role.SUPER_ADMIN && caller.role !== Role.ADMIN && caller.role !== Role.PROJECT_MANAGER) {
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

    // Deliver resend notification for account approval
    if (updated.email) {
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
          { label: "Assigned Work Role", value: updated.role }
        ]
      });
    }

    res.json({ success: true, user: updated });
  });

  app.put("/api/users/:id/details", authenticateUser, async (req, res) => {
    const { role, teamId } = req.body;
    const userElem = await dbStore.getUserById(req.params.id);
    if (!userElem) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    if (role && Object.values(Role).includes(role)) {
      await dbStore.updateUserRole(req.params.id, role);
    }
    await dbStore.updateUserTeam(req.params.id, teamId === "none" ? undefined : (teamId || undefined));

    const updated = await dbStore.getUserById(req.params.id);
    res.json({ success: true, user: updated });
  });

  app.put("/api/users/:id/role", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
    if (caller.role !== Role.SUPER_ADMIN && caller.role !== Role.ADMIN) {
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

    // Send role update alert
    if (updated.email) {
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
          { label: "Promotion Date", value: new Date().toLocaleDateString() }
        ]
      });
    }

    res.json({ success: true, user: updated });
  });

  // --- PROJECTS ENDPOINTS ---
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
      members: members || [caller.id]
    });

    await dbStore.createActivity(project.id, caller.id, caller.name, "project_created", `Created project: "${project.name}"`);

    // Notify project members + Send Email
    for (const mId of project.members) {
      if (mId !== caller.id) {
        await dbStore.createNotification(mId, "assignment", `You have been added to the project: ${project.name}`, project.id);
        const memberUser = await dbStore.getUserById(mId);
        if (memberUser && memberUser.email) {
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
              { label: "Target Timeline", value: `${project.startDate} to ${project.endDate}` }
            ]
          });
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

    // Cloudinary cleanup if coverImageUrl changes
    if (req.body.coverImageUrl && project.coverImageUrl && req.body.coverImageUrl !== project.coverImageUrl) {
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

    const filteredTeams = teams.filter(t =>
      t.name.toLowerCase().includes(q)
    );

    res.json({
      users: filteredUsers.map(u => ({ id: u.id, name: u.name, username: u.username, email: u.email })),
      teams: filteredTeams.map(t => ({ id: t.id, name: t.name, description: t.description }))
    });
  });

  // CSV Hour Tracking Export
  app.get("/api/projects/:id/hours/export", authenticateUser, async (req, res) => {
    const project = await dbStore.getProjectById(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const tasks = await dbStore.getTasks(project.id);
    const users = await dbStore.getUsers();

    let csvContent = "Task Title,Category,Worker,Hours,Manual/Tracked,Logged At,Note\n";

    tasks.forEach(task => {
      task.timeLogs.forEach(log => {
        const worker = users.find(u => u.id === log.userId)?.name || "Unknown";
        const cleanedNote = (log.note || "").replace(/"/g, '""');
        const loggedDate = log.createdAt ? log.createdAt.split("T")[0] : "";
        const trackingType = log.startTime ? "Tracked Interval" : "Manual";
        csvContent += `"${task.title}","${task.category}","${worker}",${log.hours},"${trackingType}","${loggedDate}","${cleanedNote}"\n`;
      });
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=project_${project.id}_hours.csv`);
    res.status(200).send(csvContent);
  });

  // --- TASKS ENDPOINTS ---
  app.get("/api/tasks", authenticateUser, async (req, res) => {
    const { projectId } = req.query;
    const tasks = await dbStore.getTasks(projectId ? String(projectId) : undefined);

    // Enrich tasks with project names
    const enriched = await Promise.all(tasks.map(async t => {
      const proj = await dbStore.getProjectById(t.projectId);
      return {
        ...t,
        projectName: proj ? proj.name : "Unknown Project"
      };
    }));
    res.json(enriched);
  });

  app.get("/api/tasks/:id", authenticateUser, async (req, res) => {
    const task = await dbStore.getTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: "Task not found." });
      return;
    }
    const proj = await dbStore.getProjectById(task.projectId);
    res.json({
      ...task,
      projectName: proj ? proj.name : "Unknown Project"
    });
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

    const task = await dbStore.createTask({
      projectId,
      title,
      richTextDesc: richTextDesc || "",
      status: status || "To Do",
      priority: priority || "Medium",
      category,
      dueDate,
      estimatedHours: Number(estimatedHours) || 0,
      assignees: assignees || [],
      dependencies: dependencies || []
    });

    // Send notifications + email alerts to assignees
    for (const asn of task.assignees) {
      if (asn.userId) {
        await dbStore.createNotification(
          asn.userId,
          "assignment",
          `You have been assigned to task: "${task.title}" in project "${project.name}"`,
          project.id
        );
        const memberUser = await dbStore.getUserById(asn.userId);
        if (memberUser && memberUser.email) {
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
              { label: "Target Workspace Duration", value: `${task.estimatedHours} Hours` }
            ]
          });
        }
      } else if (asn.teamId) {
        // Find users in team to notify
        const users = (await dbStore.getUsers()).filter(u => u.teamId === asn.teamId);
        for (const u of users) {
          await dbStore.createNotification(
            u.id,
            "assignment",
            `Your team has been assigned task: "${task.title}" in "${project.name}"`,
            project.id
          );
          if (u.email) {
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
                { label: "Due Date", value: task.dueDate }
              ]
            });
          }
        }
      }
    }

    await dbStore.createActivity(task.projectId, caller.id, caller.name, "task_created", `Created task: "${task.title}" (Priority: ${task.priority})`);

    res.status(201).json(task);
  });

  app.put("/api/tasks/:id", authenticateUser, async (req, res) => {
    const task = await dbStore.getTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
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
            error: `Cannot set to Done. Blocked by unfinished dependencies: ${incompleteDeps.map(t => `"${t.title}"`).join(", ")}`
          });
          return;
        }
      }
    }

    const caller = (req as any).user;
    const originalStatus = task.status;
    const updated = await dbStore.updateTask(req.params.id, req.body);

    if (updated) {
      if (originalStatus !== updated.status) {
        await dbStore.createActivity(updated.projectId, caller.id, caller.name, "task_moved", `Moved task "${updated.title}" from "${originalStatus}" to "${updated.status}"`);
      } else {
        await dbStore.createActivity(updated.projectId, caller.id, caller.name, "task_updated", `Updated task "${updated.title}"`);
      }
    }

    // Delivery notifications when task transitions to Completed ("Done")
    if (updated && originalStatus !== "Done" && updated.status === "Done") {
      const project = await dbStore.getProjectById(updated.projectId);
      const owner = project ? await dbStore.getUserById(project.ownerId) : null;

      // Notify project owner
      if (owner) {
        await dbStore.createNotification(
          owner.id,
          "status_change",
          `Task "${updated.title}" has been completed/marked as Done!`,
          project?.id
        );
        if (owner.email) {
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
              { label: "Delivery Date", value: new Date().toLocaleDateString() }
            ]
          });
        }
      }

      // Notify other assignees as well
      for (const asn of updated.assignees) {
        if (asn.userId && asn.userId !== (owner ? owner.id : "")) {
          const assignee = await dbStore.getUserById(asn.userId);
          if (assignee && assignee.email) {
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
                { label: "Parent Board", value: project?.name || "Unknown project" }
              ]
            });
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
      endTime
    });

    res.status(201).json({ success: true, log });
  });

  // --- COMMENTS ENDPOINTS ---
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

    // Log comment added on project details activity stream
    const taskObj = await dbStore.getTaskById(taskId);
    if (taskObj) {
      const strippedContent = content.replace(/<[^>]*>/g, '').substring(0, 60);
      await dbStore.createActivity(taskObj.projectId, caller.id, caller.name, "comment_added", `Commented on task "${taskObj.title}": "${strippedContent}..."`);
    }

    res.status(201).json(comment);
  });

  // --- TEAMS ENDPOINTS ---
  app.get("/api/teams", authenticateUser, async (req, res) => {
    const teamsList = await dbStore.getTeams();
    const resolvedTeams = await Promise.all(teamsList.map(async t => {
      const currentMembers = (await dbStore.getUsers()).filter(u => u.teamId === t.id);
      return {
        ...t,
        membersCount: currentMembers.length
      };
    }));
    res.json(resolvedTeams);
  });

  app.post("/api/teams", authenticateUser, async (req, res) => {
    const caller = (req as any).user;
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
    if (caller.role !== Role.SUPER_ADMIN && caller.role !== Role.ADMIN && caller.role !== Role.PROJECT_MANAGER) {
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
    await dbStore.deleteTeam(req.params.id);
    res.json({ success: true });
  });

  // --- NOTIFICATIONS SERVICE ---
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

  // --- CLOUDINARY FILE UPLOAD ROUTET ---
  app.post("/api/cloudinary/upload", authenticateUser, async (req, res) => {
    const { base64Data, filename } = req.body;
    if (!base64Data || !filename) {
      res.status(400).json({ error: "base64Data and filename parameters are mandatory." });
      return;
    }

    try {
      const result = await uploadToCloudinary(base64Data, filename, "projectflow_workspace");
      res.status(201).json({
        url: result.url,
        simulated: result.simulated
      });
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

    try {
      const ok = await deleteFromCloudinary(url);
      res.status(200).json({ success: ok });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Cloudinary delete execution error." });
    }
  });

  // --- DIRECT FILE ATTACHMENTS & CONFIRM ---
  app.post("/api/files/confirm", authenticateUser, async (req, res) => {
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

    const fileItem = {
      id: "file_" + Math.random().toString(36).substr(2, 9),
      name,
      url,
      category: category || "Specification",
      uploadedAt: new Date().toISOString()
    };

    project.files.push(fileItem);
    await dbStore.updateProject(projectId, { files: project.files });

    const caller = (req as any).user;
    await dbStore.createActivity(projectId, caller.id, caller.name, "file_uploaded", `Uploaded & registered document "${name}" under "${category || "Specification"}"`);

    res.status(201).json(fileItem);
  });

  // --- ACTIVITIES ENDPOINTS ---
  app.get("/api/projects/:id/activities", authenticateUser, async (req, res) => {
    try {
      const activities = await dbStore.getActivities(req.params.id);
      res.json(activities);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch activities." });
    }
  });

  // --- TRASH CAN / RECOVERY BOX ENDPOINTS ---
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
        await dbStore.restoreProject(id);
        if (project) {
          await dbStore.createActivity(id, caller.id, caller.name, "project_restored", `Restored project "${project.name}" from Trash box`);
        }
        res.json({ success: true, message: "Project and assigned task cards restored successfully." });
      } else if (type === "task") {
        const task = await dbStore.getTaskById(id);
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
    const { type, id } = req.params;
    try {
      if (type === "project") {
        const project = await dbStore.getProjectById(id);
        if (project) {
          // Permanently erase files from Cloudinary
          if (project.coverImageUrl) {
            await deleteFromCloudinary(project.coverImageUrl).catch(e => console.error("Cloudinary cover deletion error:", e));
          }
          if (project.files && project.files.length > 0) {
            for (const file of project.files) {
              await deleteFromCloudinary(file.url).catch(e => console.error("Cloudinary file deletion error:", e));
            }
          }
        }
        await dbStore.deleteProjectPermanent(id);
        res.json({ success: true, message: "Project and linked Cloudinary documents permanently deleted." });
      } else if (type === "task") {
        await dbStore.deleteTaskPermanent(id);
        res.json({ success: true, message: "Task card and logged comments deleted permanently." });
      } else {
        res.status(400).json({ error: "Invalid entity type. Must be project or task." });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to permanently purge element." });
    }
  });

  // Garbage Collection for Soft-deleted items older than 15 Days
  async function runTrashAutoCleanup() {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    console.log(`[GARBAGE COLLECTION] Scanning for items soft-deleted before ${fifteenDaysAgo.toISOString()}`);
    try {
      const trashedProjects = await dbStore.getTrashedProjects();
      for (const proj of trashedProjects) {
        if (proj.deletedAt && new Date(proj.deletedAt) < fifteenDaysAgo) {
          console.log(`[GARBAGE COLLECTION] Permanently purging project "${proj.name}" (ID: ${proj.id})`);
          if (proj.coverImageUrl) {
            await deleteFromCloudinary(proj.coverImageUrl).catch(e => console.error(e));
          }
          if (proj.files && proj.files.length > 0) {
            for (const f of proj.files) {
              await deleteFromCloudinary(f.url).catch(e => console.error(e));
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

  // --- VITE MIDDLEWARE FOR DEVELOPMENT OR STATIC FOR PRODUCTION ---
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

    // Trigger Trash Cleanup scanner 10 seconds post startup
    setTimeout(() => {
      runTrashAutoCleanup().catch(e => console.error("Initial cleanup pass failed:", e));
    }, 10000);

    // Schedule Trash Cleanup scanner to run every 30 minutes
    setInterval(() => {
      runTrashAutoCleanup().catch(e => console.error("Periodic cleanup pass failed:", e));
    }, 30 * 60 * 1000);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
