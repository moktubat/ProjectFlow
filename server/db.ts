/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { User, Project, Task, Team, Comment, Notification, Role, UserStatus, Activity, Invitation } from "../src/types/index.js";

dotenv.config();

const STORE_PATH = path.join(process.cwd(), "server", "store.json");

// Short, URL/ID-safe random suffix generator backed by crypto, replacing the
// old Math.random().toString(36) approach (low entropy, not collision-safe,
// and — since these IDs doubled as bearer tokens in the old auth flow —
// guessable). Sessions/tokens use crypto.randomBytes directly; this helper
// is just for readable, prefixed entity IDs (usr_..., proj_..., etc.).
function genId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}

interface SessionRecord {
  token: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

interface DatabaseSchema {
  users: User[];
  projects: Project[];
  tasks: Task[];
  teams: Team[];
  comments: Comment[];
  notifications: Notification[];
  activities: Activity[];
  invitations: Invitation[];
  sessions: SessionRecord[];
}

const initialDb: DatabaseSchema = {
  users: [],
  projects: [],
  tasks: [],
  teams: [],
  comments: [],
  notifications: [],
  activities: [],
  invitations: [],
  sessions: []
};

// Ensure server folder exists
const serverDir = path.dirname(STORE_PATH);
if (!fs.existsSync(serverDir)) {
  fs.mkdirSync(serverDir, { recursive: true });
}

function readDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      fs.writeFileSync(STORE_PATH, JSON.stringify(initialDb, null, 2));
      return initialDb;
    }
    const data = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(data);
    // Backward-compat: older store.json files won't have a `sessions` array yet.
    if (!parsed.sessions) parsed.sessions = [];
    return parsed;
  } catch (err) {
    console.error("Failed to read database store:", err);
    return initialDb;
  }
}

function writeDb(data: DatabaseSchema) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to write to database store:", err);
  }
}

// ------ MONGOOSE CONFIGURATION AND FALLBACK ------
const MONGODB_URI = process.env.MONGODB_URI;
let isMongoConnected = false;

// Exposed so server.ts can `await` full connection readiness before
// accepting traffic, instead of relying on the isMongoConnected flag alone
// (which previously could still be false for early in-flight requests).
let mongoReadyPromise: Promise<void> = Promise.resolve();

if (MONGODB_URI) {
  mongoReadyPromise = mongoose
    .connect(MONGODB_URI)
    .then(() => {
      isMongoConnected = true;
      console.log("[MONGO SUCCESS] Connected to MongoDB Atlas instance successfully.");
    })
    .catch((err) => {
      console.error("[MONGO CONNECTION ERROR] Failed to connect to MongoDB:", err.message);
      console.log("[DATABASES] Using server/store.json local storage fallback engine.");
      isMongoConnected = false;
    });
} else {
  console.log("[DATABASES INFO] No MONGODB_URI environment variable detected. Running local storage fallback.");
}

export const waitForDbReady = () => mongoReadyPromise;

// Custom Mongoose Schemas using custom String primary keys (custom id like usr_..., proj_...)
const UserSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  username: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, required: true },
  status: { type: String, required: true },
  teamId: { type: String },
  passwordHash: { type: String, required: true },
  createdAt: { type: String, required: true }
}, { versionKey: false, _id: false });

const TeamSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  leadId: { type: String, required: true },
}, { versionKey: false, _id: false });

const ProjectSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  richTextDescription: { type: String, default: "" },
  status: { type: String, required: true },
  priority: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  coverImageUrl: { type: String },
  ownerId: { type: String, required: true },
  tags: { type: [String], default: [] },
  members: { type: [String], default: [] },
  files: [{
    id: String,
    name: String,
    url: String,
    category: String,
    uploadedAt: String
  }],
  deleted: { type: Boolean, default: false },
  deletedAt: { type: String }
}, { versionKey: false, _id: false });

const TaskSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  projectId: { type: String, required: true },
  title: { type: String, required: true },
  richTextDesc: { type: String, default: "" },
  status: { type: String, required: true },
  priority: { type: String, required: true },
  category: { type: String, required: true },
  dueDate: { type: String, required: true },
  estimatedHours: { type: Number, default: 0 },
  assignees: [{ userId: String, teamId: String }],
  timeLogs: [{
    id: String, userId: String, hours: Number, note: String,
    startTime: String, endTime: String, createdAt: String
  }],
  subTasks: [{
    id: String,
    title: String,
    completed: { type: Boolean, default: false },
    createdAt: String
  }],
  dependencies: [String],
  deleted: { type: Boolean, default: false },
  deletedAt: { type: String }
}, { versionKey: false, _id: false });

const CommentSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  taskId: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userRole: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: String, required: true },
  editedAt: { type: String }
}, { versionKey: false, _id: false });

const NotificationSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  userId: { type: String, required: true },
  type: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  relatedProjectId: { type: String },
  createdAt: { type: String, required: true }
}, { versionKey: false, _id: false });

const ActivitySchema = new mongoose.Schema({
  _id: { type: String, required: true },
  projectId: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  action: { type: String, required: true },
  details: { type: String, required: true },
  createdAt: { type: String, required: true }
}, { versionKey: false, _id: false });

const InvitationSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  createdBy: { type: String, required: true },
  creatorName: { type: String },
  email: { type: String },
  role: { type: String, required: true },
  teamId: { type: String },
  teamName: { type: String },
  expiresAt: { type: String, required: true },
  usedCount: { type: Number, default: 0 },
  usedLimit: { type: Number, required: true },
  plan: { type: String, required: true },
  status: { type: String, required: true },
  createdAt: { type: String, required: true }
}, { versionKey: false, _id: false });

// Sessions are deliberately given a TTL index in Mongo so expired tokens are
// automatically reaped without needing a manual cleanup job.
const SessionSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // the token itself
  userId: { type: String, required: true },
  createdAt: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { versionKey: false, _id: false });

const MongoUser = mongoose.models.User || mongoose.model("User", UserSchema);
const MongoTeam = mongoose.models.Team || mongoose.model("Team", TeamSchema);
const MongoProject = mongoose.models.Project || mongoose.model("Project", ProjectSchema);
const MongoTask = mongoose.models.Task || mongoose.model("Task", TaskSchema);
const MongoComment = mongoose.models.Comment || mongoose.model("Comment", CommentSchema);
const MongoNotification = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
const MongoActivity = mongoose.models.Activity || mongoose.model("Activity", ActivitySchema);
const MongoInvitation = mongoose.models.Invitation || mongoose.model("Invitation", InvitationSchema);
const MongoSession = mongoose.models.Session || mongoose.model("Session", SessionSchema);

// Adapter Mapper Helpers
function mapMongoDoc<T>(doc: any): T {
  if (!doc) return null as any;
  const obj = doc.toObject ? doc.toObject() : doc;
  obj.id = obj._id;
  return obj;
}

function mapMongoDocs<T>(docs: any[]): T[] {
  return (docs || []).map(mapMongoDoc) as any;
}

export const dbStore = {
  // --- USERS ---
  getUsers: async (): Promise<User[]> => {
    if (isMongoConnected) {
      const docs = await MongoUser.find({} as any);
      return mapMongoDocs<User>(docs);
    }
    return readDb().users;
  },

  getUserById: async (id: string): Promise<User | null> => {
    if (isMongoConnected) {
      const doc = await MongoUser.findOne({ _id: id } as any);
      return mapMongoDoc<User>(doc);
    }
    return readDb().users.find(u => u.id === id) || null;
  },

  getUserByUsernameOrEmail: async (login: string): Promise<User | null> => {
    const l = login.toLowerCase();
    if (isMongoConnected) {
      const doc = await MongoUser.findOne({
        $or: [
          { username: { $regex: new RegExp(`^${l}$`, "i") } },
          { email: { $regex: new RegExp(`^${l}$`, "i") } }
        ]
      } as any);
      return mapMongoDoc<User>(doc);
    }
    return readDb().users.find(u => u.username.toLowerCase() === l || u.email.toLowerCase() === l) || null;
  },

  createUser: async (user: Omit<User, "id" | "createdAt"> & { passwordHash: string }): Promise<User> => {
    const id = genId("usr");

    const newUser = {
      _id: id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      teamId: user.teamId,
      passwordHash: user.passwordHash,
      createdAt: new Date().toISOString()
    };

    if (isMongoConnected) {
      const created = await MongoUser.create(newUser as any);
      return mapMongoDoc<User>(created);
    } else {
      const db = readDb();
      const localUser = { ...newUser, id };
      db.users.push(localUser as any);
      writeDb(db);
      return localUser as any;
    }
  },

  updateUserStatus: async (id: string, status: UserStatus): Promise<User | null> => {
    if (isMongoConnected) {
      const updated = await MongoUser.findOneAndUpdate({ _id: id } as any, { status } as any, { new: true } as any);
      return mapMongoDoc<User>(updated);
    } else {
      const db = readDb();
      const user = db.users.find(u => u.id === id);
      if (user) {
        user.status = status;
        writeDb(db);
      }
      return user || null;
    }
  },

  updateUserRole: async (id: string, role: Role): Promise<User | null> => {
    if (isMongoConnected) {
      const updated = await MongoUser.findOneAndUpdate({ _id: id } as any, { role } as any, { new: true } as any);
      return mapMongoDoc<User>(updated);
    } else {
      const db = readDb();
      const user = db.users.find(u => u.id === id);
      if (user) {
        user.role = role;
        writeDb(db);
      }
      return user || null;
    }
  },

  updateUserTeam: async (id: string, teamId: string | undefined): Promise<User | null> => {
    if (isMongoConnected) {
      const updated = await MongoUser.findOneAndUpdate({ _id: id } as any, { teamId } as any, { new: true } as any);
      return mapMongoDoc<User>(updated);
    } else {
      const db = readDb();
      const user = db.users.find(u => u.id === id);
      if (user) {
        user.teamId = teamId;
        writeDb(db);
      }
      return user || null;
    }
  },

  // Used by the login flow to transparently upgrade legacy SHA-256 password
  // hashes to bcrypt once a correct plaintext password has been verified.
  updateUserPasswordHash: async (id: string, passwordHash: string): Promise<void> => {
    if (isMongoConnected) {
      await MongoUser.updateOne({ _id: id } as any, { passwordHash } as any);
    } else {
      const db = readDb();
      const user = db.users.find(u => u.id === id);
      if (user) {
        (user as any).passwordHash = passwordHash;
        writeDb(db);
      }
    }
  },

  // --- SESSIONS ---
  // Opaque bearer tokens mapped to a userId + expiry. Tokens are generated
  // by server.ts via crypto.randomBytes — this layer only persists/looks
  // them up, mirroring the same Mongo/local-JSON dual-mode pattern used
  // everywhere else in this file.
  createSession: async (token: string, userId: string, expiresAt: string): Promise<void> => {
    const createdAt = new Date().toISOString();
    if (isMongoConnected) {
      await MongoSession.create({ _id: token, userId, createdAt, expiresAt: new Date(expiresAt) } as any);
    } else {
      const db = readDb();
      db.sessions.push({ token, userId, createdAt, expiresAt });
      writeDb(db);
    }
  },

  getSession: async (token: string): Promise<{ userId: string; expiresAt: string } | null> => {
    if (isMongoConnected) {
      const doc = await MongoSession.findOne({ _id: token } as any);
      if (!doc) return null;
      return { userId: doc.userId, expiresAt: doc.expiresAt.toISOString() };
    }
    const session = readDb().sessions.find(s => s.token === token);
    return session ? { userId: session.userId, expiresAt: session.expiresAt } : null;
  },

  deleteSession: async (token: string): Promise<void> => {
    if (isMongoConnected) {
      await MongoSession.deleteOne({ _id: token } as any);
    } else {
      const db = readDb();
      db.sessions = db.sessions.filter(s => s.token !== token);
      writeDb(db);
    }
  },

  // Invalidate every session belonging to a user — handy for "log out
  // everywhere" flows or forced de-auth after a role/status change.
  deleteSessionsForUser: async (userId: string): Promise<void> => {
    if (isMongoConnected) {
      await MongoSession.deleteMany({ userId } as any);
    } else {
      const db = readDb();
      db.sessions = db.sessions.filter(s => s.userId !== userId);
      writeDb(db);
    }
  },

  // --- PROJECTS ---
  getProjects: async (includeDeleted = false): Promise<Project[]> => {
    if (isMongoConnected) {
      const query = includeDeleted ? {} : { $or: [{ deleted: false }, { deleted: { $exists: false } }, { deleted: null }] };
      const docs = await MongoProject.find(query as any);
      return mapMongoDocs<Project>(docs);
    }
    const projects = readDb().projects;
    return includeDeleted ? projects : projects.filter(p => !p.deleted);
  },

  getProjectById: async (id: string): Promise<Project | null> => {
    if (isMongoConnected) {
      const doc = await MongoProject.findOne({ _id: id } as any);
      return mapMongoDoc<Project>(doc);
    }
    return readDb().projects.find(p => p.id === id) || null;
  },

  createProject: async (project: Omit<Project, "id" | "files">): Promise<Project> => {
    const id = genId("proj");
    const newProj = {
      _id: id,
      ...project,
      files: [],
      deleted: false
    };

    if (isMongoConnected) {
      const created = await MongoProject.create(newProj as any);
      return mapMongoDoc<Project>(created);
    } else {
      const db = readDb();
      const localProj = { ...newProj, id };
      db.projects.push(localProj);
      writeDb(db);
      return localProj;
    }
  },

  updateProject: async (id: string, data: Partial<Project>): Promise<Project | null> => {
    if (isMongoConnected) {
      const updated = await MongoProject.findOneAndUpdate({ _id: id } as any, { $set: data } as any, { new: true } as any);
      return mapMongoDoc<Project>(updated);
    } else {
      const db = readDb();
      const index = db.projects.findIndex(p => p.id === id);
      if (index === -1) return null;
      db.projects[index] = { ...db.projects[index], ...data };
      writeDb(db);
      return db.projects[index];
    }
  },

  // Soft delete (moves to trash)
  deleteProject: async (id: string): Promise<boolean> => {
    const deletedAt = new Date().toISOString();
    if (isMongoConnected) {
      await MongoProject.updateOne({ _id: id } as any, { deleted: true, deletedAt } as any);
      await MongoTask.updateMany({ projectId: id } as any, { deleted: true, deletedAt } as any);
      return true;
    } else {
      const db = readDb();
      const proj = db.projects.find(p => p.id === id);
      if (proj) {
        proj.deleted = true;
        proj.deletedAt = deletedAt;
      }
      db.tasks.forEach(t => {
        if (t.projectId === id) {
          t.deleted = true;
          t.deletedAt = deletedAt;
        }
      });
      writeDb(db);
      return true;
    }
  },

  // Hard delete (for 15 days cleanup or manual permanent delete)
  deleteProjectPermanent: async (id: string): Promise<boolean> => {
    if (isMongoConnected) {
      await MongoProject.deleteOne({ _id: id } as any);
      await MongoTask.deleteMany({ projectId: id } as any);
      return true;
    } else {
      const db = readDb();
      db.projects = db.projects.filter(p => p.id !== id);
      db.tasks = db.tasks.filter(t => t.projectId !== id);
      writeDb(db);
      return true;
    }
  },

  restoreProject: async (id: string): Promise<boolean> => {
    if (isMongoConnected) {
      await MongoProject.updateOne({ _id: id } as any, { deleted: false, $unset: { deletedAt: "" } } as any);
      await MongoTask.updateMany({ projectId: id } as any, { deleted: false, $unset: { deletedAt: "" } } as any);
      return true;
    } else {
      const db = readDb();
      const proj = db.projects.find(p => p.id === id);
      if (proj) {
        proj.deleted = false;
        proj.deletedAt = undefined;
      }
      db.tasks?.forEach(t => {
        if (t.projectId === id) {
          t.deleted = false;
          t.deletedAt = undefined;
        }
      });
      writeDb(db);
      return true;
    }
  },

  getTrashedProjects: async (): Promise<Project[]> => {
    if (isMongoConnected) {
      const docs = await MongoProject.find({ deleted: true } as any);
      return mapMongoDocs<Project>(docs);
    }
    return readDb().projects.filter(p => p.deleted === true);
  },

  // --- TASKS ---
  getTasks: async (projectId?: string, includeDeleted = false): Promise<Task[]> => {
    if (isMongoConnected) {
      const query: any = includeDeleted ? {} : { $or: [{ deleted: false }, { deleted: { $exists: false } }, { deleted: null }] };
      if (projectId) {
        query.projectId = projectId;
      }
      const docs = await MongoTask.find(query as any);
      return mapMongoDocs<Task>(docs);
    }
    const tasks = readDb().tasks;
    let filtered = includeDeleted ? tasks : tasks.filter(t => !t.deleted);
    if (projectId) {
      return filtered.filter(t => t.projectId === projectId);
    }
    return filtered;
  },

  getTaskById: async (id: string): Promise<Task | null> => {
    if (isMongoConnected) {
      const doc = await MongoTask.findOne({ _id: id } as any);
      return mapMongoDoc<Task>(doc);
    }
    return readDb().tasks.find(t => t.id === id) || null;
  },

  createTask: async (task: Omit<Task, "id" | "timeLogs">): Promise<Task> => {
    const id = genId("tsk");
    const newTsk = {
      _id: id,
      ...task,
      timeLogs: [],
      deleted: false
    };

    if (isMongoConnected) {
      const created = await MongoTask.create(newTsk as any);
      return mapMongoDoc<Task>(created);
    } else {
      const db = readDb();
      const localTsk = { ...newTsk, id };
      db.tasks.push(localTsk);
      writeDb(db);
      return localTsk;
    }
  },

  updateTask: async (id: string, data: Partial<Task>): Promise<Task | null> => {
    if (isMongoConnected) {
      const updated = await MongoTask.findOneAndUpdate({ _id: id } as any, { $set: data } as any, { new: true } as any);
      return mapMongoDoc<Task>(updated);
    } else {
      const db = readDb();
      const index = db.tasks.findIndex(t => t.id === id);
      if (index === -1) return null;
      db.tasks[index] = { ...db.tasks[index], ...data };
      writeDb(db);
      return db.tasks[index];
    }
  },

  // Soft delete
  deleteTask: async (id: string): Promise<boolean> => {
    const deletedAt = new Date().toISOString();
    if (isMongoConnected) {
      await MongoTask.updateOne({ _id: id } as any, { deleted: true, deletedAt } as any);
      return true;
    } else {
      const db = readDb();
      const t = db.tasks.find(x => x.id === id);
      if (t) {
        t.deleted = true;
        t.deletedAt = deletedAt;
      }
      writeDb(db);
      return true;
    }
  },

  // Permanent Delete
  deleteTaskPermanent: async (id: string): Promise<boolean> => {
    if (isMongoConnected) {
      await MongoTask.deleteOne({ _id: id } as any);
      await MongoComment.deleteMany({ taskId: id } as any);
      return true;
    } else {
      const db = readDb();
      db.tasks = db.tasks.filter(t => t.id !== id);
      db.comments = db.comments.filter(c => c.taskId !== id);
      writeDb(db);
      return true;
    }
  },

  restoreTask: async (id: string): Promise<boolean> => {
    if (isMongoConnected) {
      await MongoTask.updateOne({ _id: id } as any, { deleted: false, $unset: { deletedAt: "" } } as any);
      return true;
    } else {
      const db = readDb();
      const t = db.tasks.find(x => x.id === id);
      if (t) {
        t.deleted = false;
        t.deletedAt = undefined;
      }
      writeDb(db);
      return true;
    }
  },

  getTrashedTasks: async (): Promise<Task[]> => {
    if (isMongoConnected) {
      const docs = await MongoTask.find({ deleted: true } as any);
      return mapMongoDocs<Task>(docs);
    }
    return readDb().tasks.filter(t => t.deleted === true);
  },

  addTaskLog: async (taskId: string, log: Omit<any, "id" | "createdAt">): Promise<any> => {
    const logId = genId("log");
    const newLog = {
      ...log,
      id: logId,
      createdAt: new Date().toISOString()
    };

    if (isMongoConnected) {
      const updated = await MongoTask.findOneAndUpdate(
        { _id: taskId } as any,
        { $push: { timeLogs: newLog } } as any,
        { new: true } as any
      );
      return updated ? newLog : null;
    } else {
      const db = readDb();
      const task = db.tasks.find(t => t.id === taskId);
      if (!task) return null;
      task.timeLogs.push(newLog as any);
      writeDb(db);
      return newLog;
    }
  },

  // --- COMMENTS ---
  getComments: async (taskId?: string): Promise<Comment[]> => {
    if (isMongoConnected) {
      const query = taskId ? { taskId } : {};
      const docs = await MongoComment.find(query as any);
      const comments = mapMongoDocs<Comment>(docs);
      return comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    const comments = readDb().comments;
    if (taskId) {
      return comments.filter(c => c.taskId === taskId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return comments;
  },

  getCommentById: async (id: string): Promise<Comment | null> => {
    if (isMongoConnected) {
      const doc = await MongoComment.findOne({ _id: id } as any);
      return mapMongoDoc<Comment>(doc);
    }
    return readDb().comments.find(c => c.id === id) || null;
  },

  createComment: async (taskId: string, userId: string, content: string): Promise<Comment | null> => {
    const id = genId("cmt");
    let user: User | null = null;

    if (isMongoConnected) {
      const u = await MongoUser.findOne({ _id: userId } as any);
      user = mapMongoDoc<User>(u);
    } else {
      user = readDb().users.find(u => u.id === userId) || null;
    }

    if (!user) return null;

    const comment = {
      _id: id,
      taskId,
      userId,
      userName: user.name,
      userRole: user.role,
      content,
      createdAt: new Date().toISOString()
    };

    if (isMongoConnected) {
      const created = await MongoComment.create(comment as any);
      return mapMongoDoc<Comment>(created);
    } else {
      const db = readDb();
      const localCmt = { ...comment, id };
      db.comments.push(localCmt);
      writeDb(db);
      return localCmt;
    }
  },

  // Edit an existing comment's content. Authorization (own-comment-only,
  // unless admin) is enforced in server.ts before this is ever called.
  updateComment: async (id: string, content: string): Promise<Comment | null> => {
    const editedAt = new Date().toISOString();
    if (isMongoConnected) {
      const updated = await MongoComment.findOneAndUpdate(
        { _id: id } as any,
        { $set: { content, editedAt } } as any,
        { new: true } as any
      );
      return mapMongoDoc<Comment>(updated);
    } else {
      const db = readDb();
      const comment = db.comments.find(c => c.id === id);
      if (!comment) return null;
      comment.content = content;
      (comment as any).editedAt = editedAt;
      writeDb(db);
      return comment;
    }
  },

  // --- TEAMS ---
  getTeams: async (): Promise<Team[]> => {
    if (isMongoConnected) {
      const docs = await MongoTeam.find({} as any);
      return mapMongoDocs<Team>(docs);
    }
    return readDb().teams;
  },

  getTeamById: async (id: string): Promise<Team | null> => {
    if (isMongoConnected) {
      const doc = await MongoTeam.findOne({ _id: id } as any);
      return mapMongoDoc<Team>(doc);
    }
    return readDb().teams.find(t => t.id === id) || null;
  },

  createTeam: async (name: string, description: string, leadId: string): Promise<Team> => {
    const id = genId("team");
    const team = {
      _id: id,
      name,
      description,
      leadId,
      membersCount: 0
    };

    if (isMongoConnected) {
      const created = await MongoTeam.create(team as any);
      await MongoUser.updateOne({ _id: leadId } as any, { teamId: id } as any);
      return mapMongoDoc<Team>(created);
    } else {
      const db = readDb();
      const localTeam = { ...team, id };
      db.teams.push(localTeam);
      const lead = db.users.find(u => u.id === leadId);
      if (lead) {
        lead.teamId = id;
      }
      writeDb(db);
      return localTeam;
    }
  },

  updateTeam: async (id: string, data: Partial<Team>): Promise<Team | null> => {
    if (isMongoConnected) {
      const updated = await MongoTeam.findOneAndUpdate({ _id: id } as any, { $set: data } as any, { new: true } as any);
      return mapMongoDoc<Team>(updated);
    } else {
      const db = readDb();
      const item = db.teams.find(t => t.id === id);
      if (item) {
        Object.assign(item, data);
        writeDb(db);
      }
      return item || null;
    }
  },

  deleteTeam: async (id: string): Promise<boolean> => {
    if (isMongoConnected) {
      await MongoTeam.deleteOne({ _id: id } as any);
      await MongoUser.updateMany({ teamId: id } as any, { $unset: { teamId: "" } } as any);
      return true;
    } else {
      const db = readDb();
      db.teams = db.teams.filter(t => t.id !== id);
      db.users.forEach(u => {
        if (u.teamId === id) u.teamId = undefined;
      });
      writeDb(db);
      return true;
    }
  },

  // --- NOTIFICATIONS ---
  getNotifications: async (userId: string): Promise<Notification[]> => {
    if (isMongoConnected) {
      const docs = await MongoNotification.find({ userId } as any);
      const notifs = mapMongoDocs<Notification>(docs);
      return notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return readDb().notifications.filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  createNotification: async (userId: string, type: string, message: string, relatedProjectId?: string): Promise<Notification> => {
    const id = genId("notif");
    const notification = {
      _id: id,
      userId,
      type,
      message,
      isRead: false,
      relatedProjectId,
      createdAt: new Date().toISOString()
    };

    if (isMongoConnected) {
      const created = await MongoNotification.create(notification as any);
      return mapMongoDoc<Notification>(created);
    } else {
      const db = readDb();
      const localNotif = { ...notification, id };
      db.notifications.push(localNotif);
      writeDb(db);
      return localNotif;
    }
  },

  markNotificationAsRead: async (id: string): Promise<Notification | null> => {
    if (isMongoConnected) {
      const updated = await MongoNotification.findOneAndUpdate({ _id: id } as any, { isRead: true } as any, { new: true } as any);
      return mapMongoDoc<Notification>(updated);
    } else {
      const db = readDb();
      const target = db.notifications.find(n => n.id === id);
      if (target) {
        target.isRead = true;
        writeDb(db);
      }
      return target || null;
    }
  },

  markAllNotificationsAsRead: async (userId: string): Promise<boolean> => {
    if (isMongoConnected) {
      await MongoNotification.updateMany({ userId } as any, { isRead: true } as any);
      return true;
    } else {
      const db = readDb();
      db.notifications.forEach(n => {
        if (n.userId === userId) {
          n.isRead = true;
        }
      });
      writeDb(db);
      return true;
    }
  },

  // --- ACTIVITIES ---
  getActivities: async (projectId?: string): Promise<Activity[]> => {
    if (isMongoConnected) {
      const query = projectId ? { projectId } : {};
      const docs = await MongoActivity.find(query as any);
      const activities = mapMongoDocs<Activity>(docs);
      return activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    const activities = readDb().activities || [];
    if (projectId) {
      return activities.filter(a => a.projectId === projectId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  createActivity: async (projectId: string, userId: string, userName: string, action: string, details: string): Promise<Activity> => {
    const id = genId("act");
    const activity = {
      _id: id,
      projectId,
      userId,
      userName,
      action,
      details,
      createdAt: new Date().toISOString()
    };

    if (isMongoConnected) {
      const created = await MongoActivity.create(activity as any);
      return mapMongoDoc<Activity>(created);
    } else {
      const db = readDb();
      if (!db.activities) db.activities = [];
      const localAct = { ...activity, id };
      db.activities.push(localAct);
      writeDb(db);
      return localAct;
    }
  },

  // --- INVITATIONS ---
  getInvitations: async (): Promise<Invitation[]> => {
    let list: Invitation[] = [];
    if (isMongoConnected) {
      const docs = await MongoInvitation.find({} as any);
      list = mapMongoDocs<Invitation>(docs);
    } else {
      list = readDb().invitations || [];
    }

    const now = new Date();
    let dbChanged = false;
    const processed = list.map(inv => {
      if (inv.status === "active" && new Date(inv.expiresAt) < now) {
        inv.status = "expired";
        dbChanged = true;
      }
      return inv;
    });

    if (dbChanged && !isMongoConnected) {
      const db = readDb();
      db.invitations = processed;
      writeDb(db);
    } else if (dbChanged && isMongoConnected) {
      for (const item of processed) {
        if (item.status === "expired") {
          await MongoInvitation.updateOne({ _id: item.id } as any, { $set: { status: "expired" } });
        }
      }
    }

    return processed;
  },

  getInvitationById: async (id: string): Promise<Invitation | null> => {
    let invite: Invitation | null = null;
    if (isMongoConnected) {
      const doc = await MongoInvitation.findOne({ _id: id } as any);
      invite = mapMongoDoc<Invitation>(doc);
    } else {
      invite = (readDb().invitations || []).find(i => i.id === id) || null;
    }

    if (invite && invite.status === "active" && new Date(invite.expiresAt) < new Date()) {
      invite.status = "expired";
      if (isMongoConnected) {
        await MongoInvitation.updateOne({ _id: id } as any, { $set: { status: "expired" } });
      } else {
        const db = readDb();
        const index = (db.invitations || []).findIndex(i => i.id === id);
        if (index !== -1) {
          db.invitations[index].status = "expired";
          writeDb(db);
        }
      }
    }

    return invite;
  },

  createInvitation: async (invitation: Omit<Invitation, "status" | "usedCount" | "createdAt" | "expiresAt"> & { expiresAt: string }): Promise<Invitation> => {
    const defaultInvitation: Invitation = {
      ...invitation,
      usedCount: 0,
      status: "active",
      createdAt: new Date().toISOString()
    };

    if (isMongoConnected) {
      const created = await MongoInvitation.create({
        _id: invitation.id,
        ...defaultInvitation
      } as any);
      return mapMongoDoc<Invitation>(created);
    } else {
      const db = readDb();
      if (!db.invitations) db.invitations = [];
      db.invitations.push(defaultInvitation);
      writeDb(db);
      return defaultInvitation;
    }
  },

  useInvitation: async (id: string): Promise<boolean> => {
    const invite = await dbStore.getInvitationById(id);
    if (!invite || invite.status !== "active") return false;

    const newUsedCount = invite.usedCount + 1;
    let newStatus: "active" | "used_up" | "expired" = "active";
    if (invite.usedLimit > 0 && newUsedCount >= invite.usedLimit) {
      newStatus = "used_up";
    }

    if (isMongoConnected) {
      await MongoInvitation.updateOne({ _id: id } as any, {
        $inc: { usedCount: 1 },
        $set: { status: newStatus }
      });
      return true;
    } else {
      const db = readDb();
      if (!db.invitations) db.invitations = [];
      const index = db.invitations.findIndex(i => i.id === id);
      if (index === -1) return false;
      db.invitations[index].usedCount = newUsedCount;
      db.invitations[index].status = newStatus;
      writeDb(db);
      return true;
    }
  },

  revokeInvitation: async (id: string): Promise<boolean> => {
    if (isMongoConnected) {
      const res = await MongoInvitation.updateOne({ _id: id } as any, {
        $set: { status: "expired" }
      });
      return res.modifiedCount > 0;
    } else {
      const db = readDb();
      if (!db.invitations) db.invitations = [];
      const index = db.invitations.findIndex(i => i.id === id);
      if (index === -1) return false;
      db.invitations[index].status = "expired";
      writeDb(db);
      return true;
    }
  }
} as any;