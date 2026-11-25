import { describe, expect, it } from 'vitest';
import { advanceTask, commandTask, contributionStats, createTeam, dateAfter, deadlineTone, demoState, loadState, saveState, STORAGE_KEY } from '@/lib/splitup';

const now = new Date('2026-11-25T12:00:00');
function firstTeam() {
  const team = demoState(now).teams[0];
  if (!team) throw new Error('Missing demo team');
  return team;
}
describe('SplitUp project rules', () => {
  it('starts with six tasks and three finished, two by Rohan', () => {
    const stats = contributionStats(firstTeam());
    expect(stats.total).toBe(6); expect(stats.completed).toBe(3);
    expect(stats.members.find(m => m.name === 'Rohan')?.done).toBe(2);
  });
  it('warns above fair share plus 20 points only after three completed tasks', () => {
    const team = firstTeam();
    expect(contributionStats(team).members.find(m => m.name === 'Rohan')?.overloaded).toBe(true);
    team.tasks = team.tasks.filter(t => t.id !== '1');
    expect(contributionStats(team).members.find(m => m.name === 'Rohan')?.overloaded).toBe(false);
  });
  it('does not warn at the 45 percent boundary for four members', () => {
    const team = firstTeam();
    team.tasks = Array.from({ length: 20 }, (_, i) => ({ id: String(i), title: 'Task', assignee: i < 9 ? 'Rohan' : i < 13 ? 'You' : i < 17 ? 'Aisha' : 'Meera', status: 2, due: '2026-12-01' }));
    expect(contributionStats(team).members.find(m => m.name === 'Rohan')?.share).toBe(45);
    expect(contributionStats(team).members.find(m => m.name === 'Rohan')?.overloaded).toBe(false);
  });
  it('removes imbalance when completed work is evenly distributed', () => {
    const team = firstTeam();
    team.tasks = team.members.map((name, i) => ({ id: String(i), title: 'Task', assignee: name, status: 2, due: '2026-12-01' }));
    expect(contributionStats(team).members.every(m => m.share === 25 && !m.overloaded)).toBe(true);
  });
  it('warns when assigned members have finished no tasks', () => {
    expect(contributionStats(firstTeam()).members.filter(m => m.stalled).map(m => m.name)).toEqual(['You', 'Meera']);
  });
  it('moves tasks one step at a time and posts a bot message on completion', () => {
    const started = advanceTask(firstTeam(), '6');
    expect(started.tasks.find(t => t.id === '6')?.status).toBe(1);
    expect(started.msgs.length).toBe(3);
    const done = advanceTask(started, '6');
    expect(done.tasks.find(t => t.id === '6')?.status).toBe(2);
    expect(done.msgs.at(-1)?.text).toBe('You finished Test and fix bugs. Nice work!');
    expect(contributionStats(done).completed).toBe(4);
    expect(advanceTask(done, '6')).toBe(done);
  });
  it('assigns chat command tasks to the named teammate and a seven-day deadline', () => {
    expect(commandTask('/task Review schema @Aisha', firstTeam(), now)).toMatchObject({ title: 'Review schema', assignee: 'Aisha', status: 0, due: '2026-12-02' });
  });
  it('defaults command tasks to You', () => {
    expect(commandTask('/task Review schema', firstTeam(), now)?.assignee).toBe('You');
  });
  it('uses green above three days, amber through day zero, and red when late', () => {
    expect(deadlineTone(dateAfter(4, now), now)).toBe('success');
    expect(deadlineTone(dateAfter(3, now), now)).toBe('warning');
    expect(deadlineTone(dateAfter(0, now), now)).toBe('warning');
    expect(deadlineTone(dateAfter(-1, now), now)).toBe('danger');
  });
  it('always includes You first when creating a team', () => {
    const team = createTeam('New Project', 'Aisha, You, Rohan, Aisha', now);
    expect(team.members).toEqual(['You', 'Aisha', 'Rohan']);
    expect(team.code).toMatch(/^NEWP-\d{3}$/);
    expect(team.msgs[0]?.text).toContain(team.code);
    expect(team.deadline).toBe('2026-12-05');
  });
  it('survives empty, blocked and corrupted storage', () => {
    expect(loadState({ getItem: () => null }, now).teams.length).toBe(2);
    expect(loadState({ getItem: () => { throw new Error('Blocked'); } }, now).teams.length).toBe(2);
    expect(loadState({ getItem: () => '{broken' }, now).teams.length).toBe(2);
    expect(loadState({ getItem: () => JSON.stringify({ teams: [{ name: 'Bad' }], activeTeamIndex: 0, activeChannel: 'contributions' }) }, now).teams.length).toBe(2);
    expect(saveState({ setItem: () => { throw new Error('Blocked'); } }, demoState(now))).toBe(false);
  });
  it('saves and reads changed data back', () => {
    let saved = '';
    const state = demoState(now); state.activeChannel = 'task-board';
    expect(saveState({ setItem: (key, value) => { expect(key).toBe(STORAGE_KEY); saved = value; } }, state)).toBe(true);
    expect(loadState({ getItem: () => saved }, now)).toEqual(state);
  });
});import { addMember, deleteTask, reassignTask, removeMember, removeTeam, renameTeam } from '@/lib/splitup';
describe('Team management', () => {
  it('removing a teammate moves their tasks to You and clears their rating', () => {
    const team = { ...firstTeam(), fb: { Rohan: 4 } };
    const next = removeMember(team, 'Rohan');
    expect(next.members).not.toContain('Rohan');
    expect(next.tasks.filter(t => t.assignee === 'You').length).toBe(3);
    expect(next.fb).toEqual({});
  });
  it('never removes You', () => { const t = firstTeam(); expect(removeMember(t, 'You')).toBe(t); });
  it('adds unique teammates only', () => {
    expect(addMember(firstTeam(), 'Kiran').members).toContain('Kiran');
    expect(addMember(firstTeam(), 'aisha').members.length).toBe(4);
  });
  it('deletes and reassigns tasks', () => {
    expect(deleteTask(firstTeam(), '1').tasks.length).toBe(5);
    expect(reassignTask(firstTeam(), '1', 'Meera').tasks[0]?.assignee).toBe('Meera');
    expect(reassignTask(firstTeam(), '1', 'Nobody').tasks[0]?.assignee).toBe('Aisha');
  });
  it('renames teams but ignores blank names', () => {
    expect(renameTeam(firstTeam(), ' New ').name).toBe('New');
    expect(renameTeam(firstTeam(), '  ').name).toBe('DBMS Mini Project');
  });
  it('removes a team and keeps a valid selection; last team is replaced', () => {
    const s = demoState(now); s.activeTeamIndex = 1;
    expect(removeTeam(s, 0, now)).toMatchObject({ activeTeamIndex: 0 });
    const one = removeTeam(s, 0, now);
    const empty = removeTeam(one, 0, now);
    expect(empty.teams.length).toBe(1); expect(empty.teams[0]?.name).toBe('My Project');
  });
});
