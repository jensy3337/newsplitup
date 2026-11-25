import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, BarChart3, CalendarDays, Check, CheckCheck, CircleHelp, ClipboardList, Copy, Hash, LockKeyhole, MessageSquare, Plus, Send, ShieldCheck, Sparkles, Split, Star, Target, Trash2, LogOut, Settings, UserMinus, UserPlus, X, TriangleAlert, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { advanceTask, bot, channels, commandTask, contributionStats, createTeam, dateAfter, daysUntil, deadlineTone, demoState, loadState, saveState, addMember, deleteTask, reassignTask, removeMember, removeTeam, renameTeam, type AppState, type Channel, type Team } from '@/lib/splitup';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'SplitUp — A fair share for every teammate' },
    { name: 'description', content: 'Split group-project tasks, see each teammate’s contributions, and keep college deadlines in one place with SplitUp.' },
    { property: 'og:title', content: 'SplitUp — A fair share for every teammate' },
    { property: 'og:description', content: 'Your group project, working together. Tasks, contributions, deadlines and peer feedback in one shared workspace.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Index,
});
const icons = { 'team-chat': MessageSquare, 'task-board': ClipboardList, contributions: BarChart3, deadlines: CalendarDays, 'peer-feedback': Star };
const descriptions = { 'team-chat': 'The conversation starts here.', 'task-board': 'A place for every task. A clear owner for each.', contributions: 'Every bit of effort counts.', deadlines: 'Keep the finish line in sight.', 'peer-feedback': 'A little reflection goes a long way.' };
function color(index: number) { return `member-color-${Math.max(0, index) % 4}`; }
function Avatar({ name, index, online = false }: { name: string; index: number; online?: boolean }) { return <span className={`avatar ${color(index)} ${online ? 'online' : ''}`}>{name.slice(0, 1).toUpperCase()}</span>; }
function shortDate(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

function Index() {
  const [state, setState] = useState<AppState | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [modal, setModal] = useState(false);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [settings, setSettings] = useState(false);
  const [confirm, setConfirm] = useState<null | 'leave' | 'delete' | { member: string }>(null);
  useEffect(() => {
    try { setState(loadState(window.localStorage)); } catch { setState(demoState()); setStorageBlocked(true); }
  }, []);
  useEffect(() => {
    if (!state) return;
    try { setStorageBlocked(!saveState(window.localStorage, state)); } catch { setStorageBlocked(true); }
  }, [state]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 2600); return () => clearTimeout(timer); }, [notice]);
  const team = state?.teams[state.activeTeamIndex];
  function updateTeam(updater: (team: Team) => Team) {
    setState(s => s ? { ...s, teams: s.teams.map((t, i) => i === s.activeTeamIndex ? updater(t) : t) } : s);
  }
  function selectChannel(channel: Channel) { setState(s => s ? { ...s, activeChannel: channel } : s); }
  function submitTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!state) return;
    if (mode === 'join') {
      const index = state.teams.findIndex(t => t.code.toUpperCase() === String(data.get('code')).trim().toUpperCase());
      if (index < 0) { setError('No team found with that code. Check the code and try again.'); return; }
      setState({ ...state, activeTeamIndex: index, activeChannel: 'team-chat' });
    } else {
      const name = String(data.get('name')).trim();
      if (!name) { setError('Enter a project name.'); return; }
      const next = createTeam(name, String(data.get('members') ?? ''));
      while (state.teams.some(t => t.code === next.code)) next.code = createTeam(name, '').code;
      next.msgs = [bot(`Welcome to ${name}! Invite your teammates with code ${next.code}.`)];
      setState({ ...state, teams: [...state.teams, next], activeTeamIndex: state.teams.length, activeChannel: 'team-chat' });
    }
    setError(''); setModal(false);
  }
  function closeTeam(kind: 'leave' | 'delete') {
    if (!state || !team) return;
    const name = team.name;
    setState(removeTeam(state, state.activeTeamIndex));
    setSettings(false); setConfirm(null);
    setNotice(kind === 'leave' ? `You left ${name}` : `${name} was deleted`);
  }
  function confirmAction() {
    if (!confirm) return;
    if (typeof confirm === 'object') { const who = confirm.member; updateTeam(t => removeMember(t, who)); setNotice(`${who} was removed`); setConfirm(null); return; }
    closeTeam(confirm);
  }
  function addPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const name = String(new FormData(form).get('person') ?? '').trim();
    if (!name || !team) return;
    if (team.members.some(n => n.toLowerCase() === name.toLowerCase())) { setNotice(`${name} is already on the team`); return; }
    updateTeam(t => addMember(t, name)); form.reset();
  }
  async function copyCode() {
    if (!team) return;
    try { await navigator.clipboard.writeText(team.code); setNotice('Invite code copied'); } catch { setNotice(`Invite code: ${team.code}`); }
  }
  const activeChannel = state?.activeChannel ?? 'contributions';
  return <div className="app-shell">
    <nav className="team-rail" aria-label="Teams">
      <div className="brand-mark" title="SplitUp"><Split aria-label="SplitUp" /></div>
      <div className="rail-divider" />
      {state?.teams.map((t, i) => <Button key={t.code} variant="ghost" className={`team-button ${i === state.activeTeamIndex ? 'selected' : ''}`} title={t.name} aria-label={t.name} aria-pressed={i === state.activeTeamIndex} onClick={() => setState({ ...state, activeTeamIndex: i })}>{t.name.split(' ').slice(0, 2).map(n => n[0]).join('')}</Button>)}
      <Button variant="ghost" className="team-button add-team" title="Create or join a team" aria-label="Create or join a team" onClick={() => { setModal(true); setError(''); }}><Plus /></Button>
      <div className="rail-bottom"><Split size={21} aria-hidden="true" /></div>
    </nav>
    <aside className="channel-sidebar">
      <button type="button" className="team-heading" onClick={() => { setSettings(true); setConfirm(null); }} aria-label="Team settings" title="Team settings"><div><strong>{team?.name ?? 'SplitUp'}</strong><small>Team settings</small></div><Settings size={15} /></button>
      <nav className="channel-nav" aria-label="Channels"><div className="sidebar-label">Your workspace</div>{channels.map(channel => { const Icon = icons[channel]; return <Button key={channel} variant="ghost" className={`channel-button ${activeChannel === channel ? 'active' : ''}`} onClick={() => selectChannel(channel)} aria-current={activeChannel === channel ? 'page' : undefined}><Icon />{channel}</Button>; })}</nav>
      <section className="members-section"><div className="sidebar-label"><span>Teammates — {team?.members.length ?? 0}</span><Users size={12} /></div>{team?.members.map((name, i) => <div key={name} className="member-line"><Avatar name={name} index={i} online /><span className="member-name">{name}</span>{name === 'You' ? <small>that’s you</small> : <Button variant="ghost" size="icon" className="member-remove" aria-label={`Remove ${name}`} title={`Remove ${name}`} onClick={() => { setSettings(true); setConfirm({ member: name }); }}><X size={13} /></Button>}</div>)}</section>
      <div className="invite-section"><p>Good work starts with a team.</p><div className="invite-code"><span>{team?.code ?? '—'}</span><Button variant="ghost" size="icon" title="Copy invite code" aria-label="Copy invite code" onClick={copyCode}><Copy size={14} /></Button></div></div>
      <div className="user-strip"><Avatar name="You" index={0} online /><div><strong className="text-xs">You</strong><small>Ready to contribute</small></div></div>
    </aside>
    <main className="main-area">
      <header className="channel-header"><Hash /><strong>{activeChannel}</strong><span className="header-divider" /><span className="channel-description">{descriptions[activeChannel]}</span><span className="team-count"><Users size={16} />{team?.members.length ?? 0}</span></header>
      {storageBlocked && <div role="status" className="storage-warning">Your browser blocked saving. You can keep working, but changes won’t survive a reload.</div>}
      <div className="main-scroll"><div className="content-wrap">
        {!team ? <p className="text-muted-foreground">Opening your workspace…</p> : <>
          {activeChannel === 'contributions' && <Contributions team={team} onBoard={() => selectChannel('task-board')} />}
          {activeChannel === 'task-board' && <TaskBoard team={team} update={updateTeam} />}
          {activeChannel === 'team-chat' && <TeamChat team={team} update={updateTeam} />}
          {activeChannel === 'deadlines' && <Deadlines team={team} update={updateTeam} />}
          {activeChannel === 'peer-feedback' && <Feedback team={team} update={updateTeam} />}
        </>}
      </div></div>
    </main>
    <Dialog open={modal} onOpenChange={setModal}><DialogContent className="team-dialog"><DialogHeader><DialogTitle>A fresh start, together.</DialogTitle><DialogDescription>Create your project team, or join one on this device.</DialogDescription></DialogHeader><div className="modal-tabs"><Button variant={mode === 'create' ? 'default' : 'secondary'} onClick={() => { setMode('create'); setError(''); }}>Create team</Button><Button variant={mode === 'join' ? 'default' : 'secondary'} onClick={() => { setMode('join'); setError(''); }}>Join team</Button></div><form onSubmit={submitTeam} key={mode}>{mode === 'create' ? <><label className="field">Project name<input name="name" required maxLength={80} placeholder="e.g. Psychology group project" /></label><label className="field">Teammates, separated by commas<input name="members" maxLength={250} placeholder="Aisha, Rohan, Meera" /></label></> : <label className="field">Invite code<input name="code" required placeholder="e.g. DBMS-482" /></label>}{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit">{mode === 'create' ? 'Create team' : 'Join team'}<ArrowRight /></Button></form></DialogContent></Dialog>
    <Dialog open={settings} onOpenChange={o => { setSettings(o); if (!o) setConfirm(null); }}><DialogContent className="team-dialog">{team && (confirm ? <><DialogHeader><DialogTitle>{typeof confirm === 'object' ? `Remove ${confirm.member}?` : confirm === 'leave' ? `Leave ${team.name}?` : `Delete ${team.name}?`}</DialogTitle><DialogDescription>{typeof confirm === 'object' ? `Their tasks will move to you and their rating will be cleared.` : confirm === 'leave' ? 'The team disappears from your list. You can rejoin later only if it still exists on this device.' : 'All tasks, messages and ratings in this team are deleted for good.'}</DialogDescription></DialogHeader><div className="modal-tabs"><Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={confirmAction}>{typeof confirm === 'object' ? 'Remove' : confirm === 'leave' ? 'Leave team' : 'Delete team'}</Button></div></> : <><DialogHeader><DialogTitle>Team settings</DialogTitle><DialogDescription>Rename the team, manage teammates, or leave.</DialogDescription></DialogHeader><label className="field">Team name<input key={team.code} defaultValue={team.name} maxLength={80} onBlur={e => updateTeam(t => renameTeam(t, e.target.value))} /></label><div className="field">Teammates<div className="settings-members">{team.members.map((name, i) => <div key={name} className="member-line"><Avatar name={name} index={i} /><span className="member-name">{name}</span>{name === 'You' ? <small>that’s you</small> : <Button variant="ghost" size="sm" onClick={() => setConfirm({ member: name })}><UserMinus />Remove</Button>}</div>)}</div></div><form className="settings-add" onSubmit={addPerson}><input name="person" aria-label="New teammate name" maxLength={40} placeholder="Add a teammate" /><Button type="submit" variant="secondary"><UserPlus />Add</Button></form><div className="modal-tabs"><Button variant="secondary" onClick={() => setConfirm('leave')}><LogOut />Leave team</Button><Button variant="destructive" onClick={() => setConfirm('delete')}><Trash2 />Delete team</Button></div></>)}</DialogContent></Dialog>
    {notice && <div className="toast-note" role="status">{notice}</div>}
  </div>;
}
function PageHeading({ title, subtitle, badge = false }: { title: string; subtitle: string; badge?: boolean }) { return <div className="page-heading"><div><div className="eyebrow">Your team, in sync</div><h1>{title}</h1><p>{subtitle}</p></div>{badge && <span className="soft-badge"><span className="status-dot bg-success" />Live team snapshot</span>}</div>; }
function Contributions({ team, onBoard }: { team: Team; onBoard: () => void }) {
  const stats = contributionStats(team);
  const overloaded = stats.members.filter(m => m.overloaded);
  const stalled = stats.members.filter(m => m.stalled);
  const remaining = daysUntil(team.deadline);
  return <>
    <PageHeading title="A fair share for everyone." subtitle="See the effort. Celebrate the progress. Keep the work balanced." badge />
    <div className="overview">
      <div className="stat-card"><div className="stat-label">Tasks completed<CheckCheck /></div><div className="stat-value">{stats.completed}<small> / {stats.total}</small></div><div className="mini-track"><progress aria-label="Overall task completion" value={stats.completed} max={stats.total || 1} /></div></div>
      <div className="stat-card"><div className="stat-label">Team progress<Target /></div><div className="stat-value">{stats.total ? Math.round(stats.completed / stats.total * 100) : 0}<small>%</small></div><p className="stat-note">{stats.total - stats.completed} tasks left to tackle together</p></div>
      <div className="stat-card"><div className="stat-label">Submission deadline<CalendarDays /></div><div className={`stat-value tone-${deadlineTone(team.deadline)}`}>{Math.abs(remaining)}<small> days {remaining < 0 ? 'late' : 'left'}</small></div><p className="stat-note">{new Date(`${team.deadline}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
    </div>
    <div className="section-title"><h2>Who’s doing what</h2><span>Fair share: {Math.round(stats.fairShare)}% per teammate</span></div>
    <div className="contribution-table"><div className="table-head"><span>Teammate</span><span>Share of completed work</span><span className="text-right">Tasks completed</span></div>{stats.members.map((member, i) => <div key={member.name} className={`contribution-row ${color(i)}`}><div className="contribution-person"><Avatar name={member.name} index={i} /><div><strong>{member.name}</strong>{member.name === 'You' && <span className="you-label">That’s you</span>}</div></div><div className="share-cell"><progress value={member.share} max={100} aria-label={`${member.name} share of completed tasks`} /><span className="share-number">{Math.round(member.share)}%</span></div><div className="assigned-cell"><strong>{member.done}</strong> of {member.assigned} assigned</div></div>)}</div>
    <div className="section-title"><h2>A little balance check</h2><span>Better together, not on your own</span></div>
    <div className="insights">{overloaded.map(member => <div className="insight" key={member.name}><TriangleAlert /><div><h3>{member.name} is carrying more of the load</h3><p>{member.name} has completed {Math.round(member.share)}% of the work, above the {Math.round(stats.fairShare)}% fair share. Move some open tasks to other teammates to even things out.</p></div><Button variant="ghost" size="sm" className="insight-action" onClick={onBoard}>View task board<ArrowRight /></Button></div>)}{stalled.length > 0 && <div className="insight neutral"><CircleHelp /><div><h3>{stalled.map(m => m.name === 'You' ? 'You' : m.name).join(' and ')} {stalled.length === 1 && stalled[0]?.name !== 'You' ? 'has' : 'have'} yet to finish a task</h3><p>{stalled.length === 1 ? 'There’s an assigned task waiting to be finished.' : 'There are assigned tasks waiting to be finished.'} A quick check-in can help everyone get moving.</p></div></div>}{overloaded.length === 0 && stalled.length === 0 && <div className="insight good"><CheckCheck /><div><h3>Everyone is pulling together</h3><p>No uneven-workload warnings. Keep sharing the effort as the project progresses.</p></div></div>}</div>
    <div className="content-footer"><ShieldCheck />A team effort, not a competition. Every contribution matters.</div>
  </>;
}
function TaskBoard({ team, update }: { team: Team; update: (fn: (t: Team) => Team) => void }) {
  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const title = String(data.get('title')).trim();
    if (!title) return;
    const task = { id: crypto.randomUUID(), title, assignee: String(data.get('assignee')), due: String(data.get('due')), status: 0 };
    update(t => ({ ...t, tasks: [...t.tasks, task] })); form.reset();
  }
  return <><PageHeading title="Big project. Small steps." subtitle="Clear tasks, clear owners. Let’s get this over the finish line." /><form className="task-form" onSubmit={addTask}><label className="field">Task title<input name="title" required maxLength={180} placeholder="What needs to get done?" /></label><label className="field">Assignee<select name="assignee">{team.members.map(n => <option key={n}>{n}</option>)}</select></label><label className="field">Due date<input type="date" name="due" required defaultValue={dateAfter(7)} /></label><Button type="submit" className="h-10"><Plus />Add task</Button></form><div className="task-board">{['To do', 'In progress', 'Done'].map((label, status) => { const tasks = team.tasks.filter(t => t.status === status); return <section key={label} className={`board-column status-${status}`}><h2><span className="status-dot" />{label}<span className="column-count">{tasks.length}</span></h2>{tasks.map(task => <article className="task-card" key={task.id}><div className="task-title-row"><h3>{task.title}</h3><Button variant="ghost" size="icon" className="task-delete" aria-label={`Delete ${task.title}`} title="Delete task" onClick={() => update(t => deleteTask(t, task.id))}><Trash2 size={14} /></Button></div><div className="task-meta"><span className={`assignee-chip ${color(team.members.indexOf(task.assignee))}`}><Avatar name={task.assignee} index={team.members.indexOf(task.assignee)} /><select className="assignee-select" aria-label={`Assignee for ${task.title}`} value={task.assignee} onChange={e => { const who = e.target.value; update(t => reassignTask(t, task.id, who)); }}>{team.members.map(n => <option key={n}>{n}</option>)}</select></span><span className={daysUntil(task.due) < 0 && status < 2 ? 'tone-danger' : ''}>{daysUntil(task.due) < 0 && status < 2 ? 'Overdue · ' : ''}{shortDate(task.due)}</span></div>{status < 2 && <div className="task-action"><Button size="sm" variant="secondary" onClick={() => update(t => advanceTask(t, task.id))}>{status === 0 ? 'Start task' : 'Mark done'}{status === 0 ? <ArrowRight /> : <Check />}</Button></div>}</article>)}{tasks.length === 0 && <div className="empty-state">{status === 0 ? 'No tasks waiting. Add a task above to get started.' : status === 1 ? 'Ready when you are. Start a task from To do.' : 'Your wins will show up here. Finish an in-progress task.'}</div>}</section>; })}</div></>;
}
function TeamChat({ team, update }: { team: Team; update: (fn: (t: Team) => Team) => void }) {
  const [draft, setDraft] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [team.msgs.length]);
  function send(event: FormEvent) {
    event.preventDefault(); const text = draft.trim(); if (!text) return;
    const task = commandTask(text, team);
    update(t => ({ ...t, tasks: task ? [...t.tasks, task] : t.tasks, msgs: [...t.msgs, { author: 'You', text, time: new Date().toISOString(), isBot: false }, ...(task ? [bot(`Task created: ${task.title} → ${task.assignee}, due ${shortDate(task.due)}.`)] : text.startsWith('/task') ? [bot('Add a title after /task, followed by an optional @teammate.')] : [])] })); setDraft('');
  }
  return <div className="chat-layout"><div className="chat-welcome"><span className="chat-symbol"><Hash size={28} /></span><h1>Good work starts with a conversation.</h1><p>Welcome to {team.name}. You’re all on the same team.</p></div><div className="chat-messages">{team.msgs.map((msg, i) => <div className="chat-message" key={`${team.code}-${i}`}>{msg.isBot ? <span className="avatar bg-primary text-primary-foreground"><Sparkles size={18} /></span> : <Avatar name={msg.author} index={team.members.indexOf(msg.author)} />}<div className="message-body"><div className="message-meta"><strong>{msg.author}</strong>{msg.isBot && <span className="bot-tag">BOT</span>}<time>{new Date(msg.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</time></div><p>{msg.text}</p></div></div>)}<div ref={end} /></div><form className="chat-composer" onSubmit={send}><MessageSquare size={19} /><input aria-label="Message team-chat" placeholder="Message #team-chat" value={draft} maxLength={2000} onChange={e => setDraft(e.target.value)} /><Button variant="ghost" size="icon" type="submit" aria-label="Send message" title="Send message" disabled={!draft.trim()}><Send size={19} /></Button></form></div>;
}
function Deadlines({ team, update }: { team: Team; update: (fn: (t: Team) => Team) => void }) {
  const days = daysUntil(team.deadline);
  const tasks = team.tasks.filter(t => t.status < 2).sort((a, b) => a.due.localeCompare(b.due));
  return <><PageHeading title="Keep the finish line in sight." subtitle="One submission date. No last-minute surprises." /><div className="deadline-banner"><div><div className="eyebrow">Until project submission</div><div className={`countdown tone-${deadlineTone(team.deadline)}`}>{Math.abs(days)} <small>days {days < 0 ? 'late' : 'left'}</small></div></div><label className="field">Submission date<input aria-label="Submission date" type="date" required value={team.deadline} onChange={e => { const value = e.target.value; if (value) update(t => ({ ...t, deadline: value })); }} /></label></div><div className="section-title"><h2>Coming up next</h2><span>{tasks.length} open tasks</span></div>{tasks.map(task => <div key={task.id} className="deadline-row"><Avatar name={task.assignee} index={team.members.indexOf(task.assignee)} /><div><h3>{task.title}</h3><span className="text-xs text-muted-foreground">{task.assignee} · {task.status === 0 ? 'To do' : 'In progress'}</span></div><span className="date-label">{shortDate(task.due)}</span>{daysUntil(task.due) < 0 && <span className="overdue-tag">Overdue</span>}</div>)}{tasks.length === 0 && <div className="empty-state">All tasks are done. Take a moment to review your work before submission.</div>}</>;
}
function Feedback({ team, update }: { team: Team; update: (fn: (t: Team) => Team) => void }) {
  const peers = team.members.filter(n => n !== 'You');
  const hasRatings = Object.keys(team.fb).length > 0;
  return <><PageHeading title="Give credit where it’s due." subtitle="Reflect on the people who helped bring your project together." /><div className="privacy-note"><LockKeyhole /><p>Ratings are private; your teacher sees averages only. In this device-only prototype, the teacher preview below uses your own ratings. Nothing is sent to a teacher or teammate.</p></div>{peers.map(name => <div className="feedback-row" key={name}><Avatar name={name} index={team.members.indexOf(name)} /><strong>{name}</strong><div className="stars" role="group" aria-label={`Rate ${name}`}>{[1, 2, 3, 4, 5].map(rating => <Button key={rating} variant="ghost" size="icon" className={`star-button ${(team.fb[name] ?? 0) >= rating ? 'rated' : ''}`} aria-label={`Rate ${name} ${rating} ${rating === 1 ? 'star' : 'stars'}`} aria-pressed={team.fb[name] === rating} title={`${rating} ${rating === 1 ? 'star' : 'stars'}`} onClick={() => update(t => ({ ...t, fb: { ...t.fb, [name]: rating } }))}><Star size={20} /></Button>)}</div></div>)}{peers.length === 0 && <div className="empty-state">No teammates to rate yet. Create a team with teammate names to share the credit.</div>}{hasRatings && <section className="teacher-view"><h2>Teacher view <span className="bot-tag">PREVIEW</span></h2><p>Contribution ratings · one response on this device</p>{peers.map(name => <div className="teacher-rating" key={name}><span>{name}</span><span>{team.fb[name] ? `${team.fb[name].toFixed(1)} / 5` : 'Not rated'}</span></div>)}</section>}</>;
}
