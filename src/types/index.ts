/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// User Roles & Statuses
export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  PROJECT_MANAGER = "PROJECT_MANAGER",
  TEAM_LEAD = "TEAM_LEAD",
  DEVELOPER = "DEVELOPER",
  DESIGNER = "DESIGNER",
  SENIOR = "SENIOR",
  JUNIOR = "JUNIOR"
}

export enum UserStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  INACTIVE = "INACTIVE"
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  status: UserStatus;
  teamId?: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  leadId: string; // User ID
  membersCount: number;
}

export interface ProjectFile {
  id: string;
  name: string;
  url: string;
  category: string;
  uploadedAt: string;
}

export interface Project {
  id: string;
  name: string;
  richTextDescription: string;
  status: "Planning" | "In Progress" | "Review" | "Completed";
  priority: "Low" | "Medium" | "High" | "Critical";
  startDate: string;
  endDate: string;
  coverImageUrl?: string;
  ownerId: string;
  tags: string[];
  members: string[]; // User IDs
  files: ProjectFile[];
  deleted?: boolean;
  deletedAt?: string;
}

export interface TimeLog {
  id: string;
  userId: string;
  userName?: string;
  startTime?: string;
  endTime?: string;
  hours: number;
  note: string;
  createdAt: string;
}

export interface TaskAssignee {
  userId?: string;
  teamId?: string;
}

export interface Task {
  id: string;
  projectId: string;
  projectName?: string;
  title: string;
  richTextDesc: string;
  status: "To Do" | "In Progress" | "Review" | "Done";
  priority: "Low" | "Medium" | "High" | "Critical";
  category: "Development" | "Design" | "QA" | "Management" | "Billing" | "Others";
  dueDate: string;
  estimatedHours: number;
  assignees: TaskAssignee[];
  timeLogs: TimeLog[];
  dependencies?: string[];
  deleted?: boolean;
  deletedAt?: string;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userRole: string;
  content: string; // TipTap Rich Editor output (HTML/Text)
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  relatedProjectId?: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  createdAt: string;
}

export interface Invitation {
  id: string; // The token e.g. "inv_xxxxxx"
  createdBy: string; // User ID who generated it
  creatorName?: string;
  email?: string;
  role: Role;
  teamId?: string;
  teamName?: string;
  expiresAt: string; // ISO date string (7 days from creation)
  usedCount: number;
  usedLimit: number; // 0 for unlimited, or e.g. 1, 5, 10
  plan: "Free" | "Paid" | "Enterprise";
  status: "active" | "expired" | "used_up";
  createdAt: string;
}
