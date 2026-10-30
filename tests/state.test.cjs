const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

// Minimal DOM boundary: exercise application events and persisted state without a browser dependency.
function boot(saved, { blocked = false } = {}) {
  const elements = new Map(), events = {}, writes = [];
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      innerHTML: '', textContent: '', value: '', classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(type, callback) { this[type] = callback; }, close() {}, showModal() {}, reset() {}, focus() {},
    });
    return elements.get(selector);
  };
  const context = vm.createContext({
    console, structuredClone, Date, Math, setTimeout() {}, clearTimeout() {},
    location: { hash: '' }, confirm: () => true,
    document: { querySelector: element, querySelectorAll: () => [],
      body: { classList: { toggle() {} } },
      addEventListener(type, callback) { (events[type] ||= []).push(callback); } },
    window: { addEventListener() {}, scrollTo() {} },
    localStorage: {
      getItem() { return saved ? JSON.stringify(saved) : null; },
      setItem(key, value) { if (blocked) throw Error('Storage blocked'); writes.push(JSON.parse(value)); },
    },
  });
  vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  const state = () => JSON.parse(run('JSON.stringify(state)'));
  const click = dataset => events.click.forEach(fn => fn({ target: { closest: () => ({ dataset }) } }));
  const submit = (id, fields) => {
    const form = { id, elements: Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, { value, checked: value }])) };
    events.submit.forEach(fn => fn({ target: form, preventDefault() {} }));
  };
  const submitForm=(selector,values)=>{const form=element(selector);form.elements=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value,setCustomValidity(){},reportValidity(){},focus(){}}]));form.submit({target:form,preventDefault(){}});};
  return { run, state, click, submit, submitForm, element, writes };
}

test('fresh visitors have no invented name, tasks, notes or progress', () => {
  const app = boot();
  assert.equal(app.state().name, '');
  assert.deepEqual(app.state().tasks, []);
  assert.deepEqual(app.state().notes, []);
  assert.match(app.run('todayPage()'), /Hej! Lite i taget\./);
  assert.match(app.run('progressPage()'), /Alla börjar någonstans/);
});

test('optional names can be entered, persisted and cleared', () => {
  const app = boot();
  app.submit('settings-form', { name: '  Mali  ', reduced: false });
  assert.equal(app.writes.at(-1).name, 'Mali');
  const reopened = boot(app.writes.at(-1));
  assert.match(reopened.run('todayPage()'), /Lite i taget, Mali\./);
  reopened.submit('settings-form', { name: '   ', reduced: true });
  assert.equal(reopened.writes.at(-1).name, '');
  assert.match(reopened.run('todayPage()'), /Hej! Lite i taget\./);
});

test('legacy default Alex is removed while tasks and notes are preserved', () => {
  const app = boot({ name: 'Alex', welcomed: false, tasks: [{ id: 'my-task', title: 'My own task' }], notes: [{ id: 'note', title: 'My note', body: 'Keep me' }] });
  assert.equal(app.state().name, '');
  assert.equal(app.state().tasks[0].title, 'My own task');
  assert.equal(app.state().notes[0].body, 'Keep me');
  assert.equal(boot({ name: 'Alex', welcomed: true, tasks: [], notes: [] }).state().name, 'Alex');
});

test('removing marked examples preserves real user content', () => {
  const app = boot({ version: 2, tasks: [{ id: 'demo', title: 'Demo', example: true }, { id: 'own', title: 'Keep this' }], notes: [{ id: 'n1', title: 'Demo note', example: true }, { id: 'n2', title: 'Keep note' }] });
  app.click({ clearExamples: '' });
  assert.deepEqual(app.state().tasks.map(t => t.id), ['own']);
  assert.deepEqual(app.state().notes.map(n => n.id), ['n2']);
});

test('completing and reopening a task updates persisted progress', () => {
  const app = boot({ version: 2, tasks: [{ id: 'a', title: 'Read a chapter' }], notes: [] });
  app.run('toggleTask("a")');
  assert.equal(app.writes.at(-1).tasks[0].done, true);
  assert.ok(app.writes.at(-1).tasks[0].completedAt);
  app.run('toggleTask("a")');
  assert.equal(app.writes.at(-1).tasks[0].done, false);
  assert.equal(app.writes.at(-1).tasks[0].completedAt, undefined);
});

test('name and task content are escaped rather than rendered as markup', () => {
  const app = boot({ version: 2, name: '<img src=x onerror=alert(1)>', tasks: [{ id: 'a', title: '<script>alert(1)</script>' }], notes: [] });
  const html = app.run('todayPage()');
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.match(html, /&lt;script&gt;/);
});

test('blocked storage never reports that a change was saved', () => {
  const app = boot(null, { blocked: true });
  app.submit('settings-form', { name: 'Mali', reduced: false });
  assert.match(app.element('#toast').textContent, /Kunde inte spara/);
});

test('calendar renders the correct number of days including leap February', () => {
  const app = boot();
  app.run('month = new Date(2028, 1, 1)');
  assert.equal((app.run('calendarPage()').match(/data-day=/g) || []).length, 29);
  app.run('month = new Date(2027, 1, 1)');
  assert.equal((app.run('calendarPage()').match(/data-day=/g) || []).length, 28);
});


test('new tasks save trimmed content and checklist lines, and edits preserve checked steps', () => {
  const app=boot();
  const fields={id:'',title:'  Homework  ',category:'Skola',date:'',time:'',description:'  Notes  ',checklist:'Read\n\nReview'};
  app.submitForm('#task-form',fields);
  const task=app.state().tasks[0];
  assert.equal(task.title,'Homework');assert.equal(task.description,'Notes');assert.equal(task.date,'');assert.equal(task.checklist.length,2);
  app.run('state.tasks[0].checklist[0].done=true');
  app.submitForm('#task-form',{...fields,id:task.id,title:'Homework edited'});
  assert.equal(app.state().tasks.length,1);assert.equal(app.state().tasks[0].checklist[0].done,true);
  const reopen=boot(app.writes.at(-1));assert.equal(reopen.state().tasks[0].title,'Homework edited');
});

test('notes can be created and edited without duplicating the original', () => {
  const app=boot();app.submitForm('#note-form',{id:'',title:'  My note  ',body:'One thought'});
  const note=app.state().notes[0];assert.equal(note.title,'My note');
  app.submitForm('#note-form',{id:note.id,title:'My edited note',body:'Second thought'});
  assert.equal(app.state().notes.length,1);assert.equal(app.state().notes[0].body,'Second thought');
  assert.equal(boot(app.writes.at(-1)).state().notes[0].title,'My edited note');
});

test('today shows overdue pending work but excludes old completed tasks', () => {
  const app=boot({version:2,tasks:[{id:'old-done',title:'Old done',done:true,date:'2020-01-01',completedAt:'2020-01-01'},{id:'old-pending',title:'Overdue task',date:'2020-01-01'},{id:'future',title:'Future task',date:'2099-01-01'}],notes:[]});
  const html=app.run('todayPage()');assert.ok(!html.includes('Old done'));assert.ok(html.includes('Overdue task'));
  // Future work remains visible as the next calendar event, but not as a task row.
  assert.ok(!html.includes('data-details="future"'));
});

test('saving changes to an example turns it into personal content', () => {
  const app=boot({version:2,tasks:[{id:'a',title:'Example',example:true}],notes:[]});
  app.submitForm('#task-form',{id:'a',title:'My own plan',category:'Personligt',date:'',time:'',description:'',checklist:''});
  app.click({clearExamples:''});assert.equal(app.state().tasks.length,1);assert.equal(app.state().tasks[0].title,'My own plan');
});
