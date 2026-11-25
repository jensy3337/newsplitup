export type Channel = 'team-chat' | 'task-board' | 'contributions' | 'deadlines' | 'peer-feedback';
export type Task = { id: string; title: string; assignee: string; status: number; due: string };
export type Message = { author: string; text: string; time: string; isBot: boolean };
export type Team = { name: string; code: string; deadline: string; members: string[]; tasks: Task[]; msgs: Message[]; fb: Record<string, number>; roles?: Record<string, Role> };
export type Role = 'leader' | 'moderator' | 'member';
export type Profile = { name: string; avatar: string; bio: string; pronouns: string; status: string };
export type AppState = { teams: Team[]; activeTeamIndex: number; activeChannel: Channel; profile?: Profile };
export const channels: Channel[] = ['team-chat', 'task-board', 'contributions', 'deadlines', 'peer-feedback'];
export const STORAGE_KEY = 'splitup-v1';
export function dateAfter(days: number, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function daysUntil(date: string, now = new Date()): number {
  const today = dateAfter(0, now);
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}
export function deadlineTone(date: string, now = new Date()) {
  const days = daysUntil(date, now);
  return days < 0 ? 'danger' : days <= 3 ? 'warning' : 'success';
}
export function bot(text: string): Message {
  return { author: 'Taskbot', text, time: new Date().toISOString(), isBot: true };
}
export function createTeam(name: string, names: string, now = new Date()): Team {
  const members = [...new Set(['You', ...names.split(',').map(n => n.trim()).filter(Boolean)])];
  const prefix = name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'TEAM';
  const code = `${prefix}-${Math.floor(100 + Math.random() * 900)}`;
  return { name, code, deadline: dateAfter(10, now), members, tasks: [], msgs: [bot(`Welcome to ${name}! Invite your teammates with code ${code}.`)], fb: {}, roles: { You: 'leader' } };
}
export function demoState(now = new Date()): AppState {
  const team = createTeam('DBMS Mini Project', 'Aisha, Rohan, Meera', now);
  team.code = 'DBMS-482';
  team.tasks = [
    { id: '1', title: 'Draw ER diagram', assignee: 'Aisha', status: 2, due: dateAfter(-2, now) },
    { id: '2', title: 'Write SQL schema', assignee: 'Rohan', status: 2, due: dateAfter(1, now) },
    { id: '3', title: 'Build login module', assignee: 'Rohan', status: 2, due: dateAfter(3, now) },
    { id: '4', title: 'Prepare report draft', assignee: 'Meera', status: 1, due: dateAfter(4, now) },
    { id: '5', title: 'Make presentation slides', assignee: 'Aisha', status: 0, due: dateAfter(6, now) },
    { id: '6', title: 'Test and fix bugs', assignee: 'You', status: 0, due: dateAfter(7, now) },
  ];
  team.msgs = [bot('Your project is ready. Six tasks, four teammates. Let’s make it a team effort!'), { author: 'Aisha', text: 'ER diagram is done! I’ll pick up the presentation slides next.', time: new Date(now.getTime() - 3600000).toISOString(), isBot: false }, { author: 'Rohan', text: 'SQL schema and login module are ready. Can someone help test them?', time: new Date(now.getTime() - 1800000).toISOString(), isBot: false }];
  const second = createTeam('Marketing Case Study', 'Dev, Sana', now);
  second.code = 'MKTG-731';
  second.roles = { Dev: 'leader', You: 'member' };
  second.tasks = [{ id: 'm1', title: 'Research the target audience', assignee: 'Dev', status: 0, due: dateAfter(7, now) }];
  team.roles = { You: 'leader', Rohan: 'moderator' };
  return { teams: [team, second], activeTeamIndex: 0, activeChannel: 'contributions', profile: defaultProfile() };
}
export function contributionStats(team: Team) {
  const completed = team.tasks.filter(t => t.status === 2).length;
  const fairShare = 100 / team.members.length;
  const members = team.members.map(name => {
    const assigned = team.tasks.filter(t => t.assignee === name).length;
    const done = team.tasks.filter(t => t.assignee === name && t.status === 2).length;
    const share = completed ? done / completed * 100 : 0;
    return { name, assigned, done, share, overloaded: completed >= 3 && share > fairShare + 20, stalled: assigned > 0 && done === 0 };
  });
  return { completed, total: team.tasks.length, fairShare, members };
}
export function advanceTask(team: Team, id: string): Team {
  const task = team.tasks.find(t => t.id === id);
  if (!task || task.status >= 2) return team;
  return { ...team, tasks: team.tasks.map(t => t.id === id ? { ...t, status: t.status + 1 } : t), msgs: task.status === 1 ? [...team.msgs, bot(`${task.assignee} finished ${task.title}. Nice work!`)] : team.msgs };
}
export function commandTask(text: string, team: Team, now = new Date()): Task | null {
  if (!text.startsWith('/task ')) return null;
  const content = text.slice(6).trim();
  const match = content.match(/\s+@(.+)$/);
  const name = match?.[1]?.trim();
  const assignee = team.members.find(n => n.toLowerCase() === name?.toLowerCase()) ?? 'You';
  const title = (match ? content.slice(0, match.index) : content).trim();
  return title ? { id: crypto.randomUUID(), title, assignee, status: 0, due: dateAfter(7, now) } : null;
}
export function loadState(storage: Pick<Storage, 'getItem'>, now = new Date()): AppState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return demoState(now);
    const value: unknown = JSON.parse(raw);
    if (!validState(value)) return demoState(now);
    return { ...value, profile: normalizeProfile(value.profile) };
  } catch { return demoState(now); }
}
function validState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const s = value as AppState;
  return Array.isArray(s.teams) && s.teams.length > 0 && Number.isInteger(s.activeTeamIndex) && s.activeTeamIndex >= 0 && s.activeTeamIndex < s.teams.length && channels.includes(s.activeChannel) && s.teams.every(t => typeof t.name === 'string' && typeof t.code === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.deadline) && Array.isArray(t.members) && t.members.includes('You') && t.members.every(n => typeof n === 'string') && Array.isArray(t.tasks) && t.tasks.every(task => typeof task.id === 'string' && typeof task.title === 'string' && t.members.includes(task.assignee) && [0, 1, 2].includes(task.status) && /^\d{4}-\d{2}-\d{2}$/.test(task.due)) && Array.isArray(t.msgs) && t.msgs.every(m => typeof m.author === 'string' && typeof m.text === 'string' && typeof m.time === 'string' && typeof m.isBot === 'boolean') && !!t.fb && typeof t.fb === 'object' && Object.values(t.fb).every(r => typeof r === 'number' && r >= 1 && r <= 5) && (t.roles === undefined || (typeof t.roles === 'object' && !!t.roles && Object.values(t.roles).every(r => r === 'leader' || r === 'moderator' || r === 'member'))));
}
export function saveState(storage: Pick<Storage, 'setItem'>, state: AppState): boolean {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}export function renameTeam(team: Team, name: string): Team {
  const clean = name.trim().slice(0, 80);
  return clean ? { ...team, name: clean } : team;
}
export function addMember(team: Team, name: string): Team {
  const clean = name.trim().slice(0, 40);
  if (!clean || team.members.some(n => n.toLowerCase() === clean.toLowerCase())) return team;
  return { ...team, members: [...team.members, clean], msgs: [...team.msgs, bot(`${clean} joined the team. Welcome!`)] };
}
/** Removes a teammate; their tasks move to You and their rating is cleared. You can't be removed. */
export function removeMember(team: Team, name: string): Team {
  if (name === 'You' || !team.members.includes(name)) return team;
  const { [name]: _removed, ...fb } = team.fb;
  const { [name]: _role, ...roles } = team.roles ?? {};
  const moved = team.tasks.filter(t => t.assignee === name).length;
  return { ...team, members: team.members.filter(n => n !== name), tasks: team.tasks.map(t => t.assignee === name ? { ...t, assignee: 'You' } : t), fb, roles, msgs: [...team.msgs, bot(`${name} was removed from the team.${moved ? ` ${moved} task${moved === 1 ? '' : 's'} moved to You.` : ''}`)] };
}
export function deleteTask(team: Team, id: string): Team {
  return { ...team, tasks: team.tasks.filter(t => t.id !== id) };
}
export function reassignTask(team: Team, id: string, assignee: string): Team {
  if (!team.members.includes(assignee)) return team;
  return { ...team, tasks: team.tasks.map(t => t.id === id ? { ...t, assignee } : t) };
}
/** Deletes or leaves a team. If it was the last one, a blank team takes its place. */
export function removeTeam(state: AppState, index: number, now = new Date()): AppState {
  if (index < 0 || index >= state.teams.length) return state;
  const teams = state.teams.filter((_, i) => i !== index);
  if (teams.length === 0) return { teams: [createTeam('My Project', '', now)], activeTeamIndex: 0, activeChannel: 'team-chat' };
  return { ...state, teams, activeTeamIndex: Math.min(state.activeTeamIndex > index ? state.activeTeamIndex - 1 : state.activeTeamIndex, teams.length - 1) };
}

export function defaultProfile(): Profile { return { name: 'You', avatar: '', bio: '', pronouns: '', status: 'Ready to contribute' }; }
export function normalizeProfile(p: unknown): Profile {
  const d = defaultProfile();
  if (!p || typeof p !== 'object') return d;
  const v = p as Record<string, unknown>;
  const str = (k: keyof Profile, max: number) => typeof v[k] === 'string' ? (v[k] as string).slice(0, max) : d[k];
  const avatar = str('avatar', 400000);
  return { name: str('name', 40).trim() || 'You', avatar: avatar.startsWith('data:image/') ? avatar : '', bio: str('bio', 160), pronouns: str('pronouns', 20), status: str('status', 60) };
}
/** Everyone can edit their own profile; blank names fall back to "You". */
export function updateProfile(p: Profile, changes: Partial<Profile>): Profile { return normalizeProfile({ ...p, ...changes }); }
export function roleOf(team: Team, name: string): Role {
  const r = team.roles?.[name];
  if (r) return r;
  // teams without a stored leader: You lead them
  return name === 'You' && !Object.values(team.roles ?? {}).includes('leader') ? 'leader' : 'member';
}
export function canManage(team: Team, actor: string): boolean { return roleOf(team, actor) !== 'member'; }
/** Leaders can give any role (handing over leadership demotes them to moderator). Moderators can only switch members/moderators below leader. */
export function assignRole(team: Team, actor: string, target: string, role: Role): Team {
  if (!team.members.includes(target) || actor === target) return team;
  const a = roleOf(team, actor), t = roleOf(team, target);
  if (a === 'member') return team;
  if (a === 'moderator' && (role === 'leader' || t === 'leader')) return team;
  const roles: Record<string, Role> = {};
  for (const m of team.members) roles[m] = roleOf(team, m);
  if (role === 'leader') roles[actor] = 'moderator';
  roles[target] = role;
  return { ...team, roles };
}
/** Leaders remove anyone; moderators remove members only. */
export function canRemove(team: Team, actor: string, target: string): boolean {
  if (actor === target || target === 'You') return false;
  const a = roleOf(team, actor);
  return a === 'leader' || (a === 'moderator' && roleOf(team, target) === 'member');
}
export function canDeleteTeam(team: Team, actor: string): boolean { return roleOf(team, actor) === 'leader'; }
