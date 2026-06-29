(function(){

const voiceBtn=document.getElementById('voiceBtn');
const voiceStatus=document.getElementById('voiceStatus');

if(!voiceBtn || !voiceStatus){ return; }

const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;

if(!SpeechRecognition){
    voiceStatus.textContent='Speech Not Supported';
    voiceBtn.disabled=true;
    return;
}

const recognition=new SpeechRecognition();
recognition.lang='en-US';
recognition.continuous=false;
recognition.interimResults=false;
recognition.maxAlternatives=1;

let multiTaskMode=false;
let multiTaskType='daily';
let multiTaskBuffer=[];
let multiDeleteMode=false;
let multiDeleteBuffer=[];
let sessionActive=false;
let editMode=false;
let editTargetTask=null;

function guidance(){ return typeof cfg!=='undefined' && cfg.voiceGuidance; }

function speak(text){
    if('speechSynthesis' in window){
        const u=new SpeechSynthesisUtterance(text);
        u.rate=1.0; u.pitch=1.0;
        window.speechSynthesis.speak(u);
    }
}

function setStatus(text,cls=''){
    voiceStatus.textContent=text;
    voiceStatus.className='voice-status';
    if(cls){ voiceStatus.classList.add(cls); }
}

function normalize(str){ return str.toLowerCase().trim().replace(/[^\w\s]/g,''); }

function findTask(query){
    query=normalize(query);
    let exact=null, partial=null;
    for(const task of tasks){
        const n=normalize(task.name);
        if(n===query){ exact=task; break; }
        if(n.includes(query)||query.includes(n)){ partial=task; }
    }
    return exact||partial;
}

// Parse time from string e.g. "3pm", "3:30pm", "15:00", "3 30 pm"
function parseTime(str){
    str=str.toLowerCase().trim();
    let h,m=0;
    let match;

    match=str.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
    if(match){
        h=parseInt(match[1]); m=parseInt(match[2]);
        if(match[3]==='pm' && h!==12) h+=12;
        if(match[3]==='am' && h===12) h=0;
        return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
    }
    match=str.match(/(\d{1,2})\s*(am|pm)/);
    if(match){
        h=parseInt(match[1]);
        if(match[2]==='pm' && h!==12) h+=12;
        if(match[2]==='am' && h===12) h=0;
        return String(h).padStart(2,'0')+':00';
    }
    return '';
}

// Parse priority from string
function parsePriority(str){
    str=str.toLowerCase();
    if(/high|urgent|important/.test(str)) return 'high';
    if(/low|minor|trivial/.test(str)) return 'low';
    return 'mid';
}

// Strip time and priority keywords from task name
function cleanTaskName(str){
    return str
        .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?/gi,'')
        .replace(/\b(high|low|medium|urgent|important|minor|trivial)\s*priority\b/gi,'')
        .replace(/\bpriority\s*(high|low|medium|urgent|important|minor|trivial)\b/gi,'')
        .trim();
}

function addTaskVoice(raw, type){
    if(!raw){ setStatus('Command Not Understood','error'); speak('Command not understood'); return; }
    const time=parseTime(raw);
    const prio=parsePriority(raw);
    const name=cleanTaskName(raw);
    if(!name){ setStatus('Command Not Understood','error'); speak('Command not understood'); return; }
    document.getElementById('t-name').value=name;
    document.getElementById('t-prio').value=prio;
    document.getElementById('t-type').value=type||activeTab;
    document.getElementById('t-time').value=time;
    saveTask();
    setStatus('Task Added','success');
    speak('Task added: '+name+(time?' at '+time:'')+(prio!=='mid'?', '+prio+' priority':''));
}

function completeTaskVoice(taskName){
    const task=findTask(taskName);
    if(!task){ setStatus('Task Not Found','error'); speak('Task not found'); return; }
    if(task.done){ setStatus('Task Already Complete','error'); speak('Task already complete'); return; }
    toggle(task.id);
    setStatus('Task Completed','success');
    speak('Task completed: '+task.name);
}

function deleteTaskVoice(taskName){
    const task=findTask(taskName);
    if(!task){ setStatus('Task Not Found','error'); speak('Task not found'); return; }
    del(task.id);
    setStatus('Task Deleted','success');
    speak('Task deleted: '+task.name);
}

function clearAllTasksVoice(){
    if(typeof clearAll==='function'){ clearAll(); }
    else{ tasks.length=0; save(); render(); }
    setStatus('All Tasks Cleared','success');
    speak('All tasks have been cleared');
}

function clearCompletedVoice(){
    const before=tasks.length;
    tasks=tasks.filter(t=>!t.done);
    save(); render();
    const removed=before-tasks.length;
    setStatus('Completed Tasks Cleared','success');
    speak(removed+' completed task'+(removed!==1?'s':'')+' removed');
}

function switchToDark(){
    if(!document.body.classList.contains('dark')){ toggleDark(); }
    setStatus('Dark Mode On','success');
    speak('Dark mode enabled');
}

function switchToLight(){
    if(document.body.classList.contains('dark')){ toggleDark(); }
    setStatus('Light Mode On','success');
    speak('Light mode enabled');
}

function setBrightnessVoice(pct){
    pct=Math.min(100,Math.max(40,pct));
    if(typeof setBrightness==='function'){ setBrightness(pct); }
    setStatus('Brightness '+pct+'%','success');
    speak('Brightness set to '+pct+' percent');
}

function giveSummary(){
    const total=tasks.length;
    const done=tasks.filter(t=>t.done).length;
    const pending=tasks.filter(t=>!t.done).length;
    const pct=total?Math.round((done/total)*100):0;
    setStatus('Summary','success');
    speak('You have '+total+' tasks in total. '+done+' completed, '+pending+' pending. Overall completion is '+pct+' percent.');
    if(typeof showAlert==='function'){
        showAlert('📋','Summary',total+' total • '+done+' done • '+pending+' pending • '+pct+'% complete');
    }
}

function openDailyTasks(){
    switchView('dashboard');
    if(typeof switchTab==='function') switchTab('daily');
    setStatus('Daily Tasks','success');
    speak('Showing daily tasks');
}

function openWeeklyTasks(){
    switchView('dashboard');
    if(typeof switchTab==='function') switchTab('weekly');
    setStatus('Weekly Tasks','success');
    speak('Showing weekly tasks');
}

function showTasks(){
    switchView('dashboard');
    setStatus('Showing Tasks','success');
    speak('Showing your tasks');
}

function dismissModal(){
    if(document.getElementById('alertModal').classList.contains('open')){
        if(typeof closeAlert==='function') closeAlert();
    } else if(document.getElementById('addModal').classList.contains('open')){
        if(typeof closeAdd==='function') closeAdd();
    }
    setStatus('Dismissed','success');
}

function openSettingsVoice(){
    if(typeof switchView==='function') switchView('settings');
    setStatus('Settings','success');
    speak('Opening settings');
}

function openDashboardVoice(){
    if(typeof switchView==='function') switchView('dashboard');
    setStatus('Dashboard','success');
    speak('Opening dashboard');
}

function activateDocket(){
    sessionActive=true;
    setStatus('Ready','success');
    speak('Docket is ready. How may I assist you?');
}

function closeDocket(){
    sessionActive=false;
    multiTaskMode=false;
    multiDeleteMode=false;
    editMode=false;
    editTargetTask=null;
    setStatus('Inactive');
    speak('Docket is now closed.');
}

function listenNext(){
    setTimeout(()=>{ try{ recognition.start(); } catch(e){ console.error(e); } },900);
}

// ── MULTI-TASK MODE ──
function enterMultiTaskMode(type){
    multiTaskMode=true;
    multiTaskType=type;
    multiTaskBuffer=[];
    setStatus('Adding '+type+' tasks...','listening');
    const prompt=guidance()
        ? 'Please state each task name clearly, followed by a brief pause. You may include a time by saying "at" followed by the time, and a priority by saying high or low priority. Say done when you have finished.'
        : 'State your tasks. Say done when finished.';
    speak(prompt);
    listenNext();
}

function handleMultiTaskInput(command){
    if(/^(?:done|finish|finished|that(?:'s| is)(?: all)?|stop|end)$/i.test(command.trim())){
        multiTaskMode=false;
        const count=multiTaskBuffer.length;
        setStatus(count+' task'+(count!==1?'s':'')+' added','success');
        speak(count+' task'+(count!==1?'s':'')+' added successfully');
        multiTaskBuffer=[];
        return;
    }
    addTaskVoice(command,multiTaskType);
    multiTaskBuffer.push(command);
    setStatus('Added. Next task or "done"','listening');
    if(guidance()) speak('Added. Please state the next task, or say done to finish.');
    else speak('Added. Next?');
    listenNext();
}

// ── MULTI-DELETE MODE ──
function enterMultiDeleteMode(){
    multiDeleteMode=true;
    multiDeleteBuffer=[];
    setStatus('Deleting tasks...','listening');
    const prompt=guidance()
        ? 'Please state the name of each task you wish to delete. Say done when you have finished.'
        : 'State tasks to delete. Say done when finished.';
    speak(prompt);
    listenNext();
}

function handleMultiDeleteInput(command){
    if(/^(?:done|finish|finished|that(?:'s| is)(?: all)?|stop|end)$/i.test(command.trim())){
        multiDeleteMode=false;
        const count=multiDeleteBuffer.length;
        setStatus(count+' task'+(count!==1?'s':'')+' deleted','success');
        speak(count+' task'+(count!==1?'s':'')+' deleted');
        multiDeleteBuffer=[];
        return;
    }
    const task=findTask(command);
    if(task){
        del(task.id);
        multiDeleteBuffer.push(command);
        if(guidance()) speak('Deleted. Please state the next task, or say done to finish.');
        else speak('Deleted. Next?');
    } else {
        speak('Task not found. Next?');
    }
    setStatus('Say next task or "done"','listening');
    listenNext();
}

// ── EDIT MODE ──
function enterEditMode(taskName){
    const task=findTask(taskName);
    if(!task){ setStatus('Task Not Found','error'); speak('Task not found'); return; }
    editMode=true;
    editTargetTask=task;
    setStatus('Renaming: '+task.name,'listening');
    if(guidance()) speak('Task found: '+task.name+'. Please state the new name for this task.');
    else speak('New name?');
    listenNext();
}

function handleEditInput(command){
    if(/^(?:cancel|stop|never mind|abort)$/i.test(command.trim())){
        editMode=false; editTargetTask=null;
        setStatus('Edit Cancelled');
        speak('Edit cancelled');
        return;
    }
    const newName=cleanTaskName(command);
    if(!newName){ speak('Could not understand the new name. Please try again.'); listenNext(); return; }
    editTargetTask.name=newName;
    save(); render();
    editMode=false;
    editTargetTask=null;
    setStatus('Task Renamed','success');
    speak('Task renamed to: '+newName);
}

function processCommand(command){
    console.log('Voice Command:',command);
    let match;

    if(multiTaskMode){ handleMultiTaskInput(command); return; }
    if(multiDeleteMode){ handleMultiDeleteInput(command); return; }
    if(editMode){ handleEditInput(command); return; }

    // Wake
    if(/(?:activate|start|begin|launch|open)\s+docket/i.test(command)||/docket\s+(?:begin|start|activate|launch)/i.test(command)){
        activateDocket(); return;
    }

    // Block if inactive
    if(!sessionActive){ setStatus('Say "Activate Docket" to begin'); return; }

    // Close
    if(/(?:close|deactivate|stop|shut down|exit)\s+docket/i.test(command)||/docket\s+(?:close|deactivate|stop|exit)/i.test(command)){
        closeDocket(); return;
    }

    // Dismiss modal
    if(/^(?:dismiss|okay|ok|close|got it|confirm)$/i.test(command.trim())){
        dismissModal(); return;
    }

    // Settings / Dashboard navigation
    if(/open settings|go to settings|show settings/i.test(command)){ openSettingsVoice(); return; }
    if(/open dashboard|go (?:to )?(?:home|dashboard)|show dashboard/i.test(command)){ openDashboardVoice(); return; }

    // Multi-task mode
    if(/add daily task(?:s)?$/i.test(command)){ enterMultiTaskMode('daily'); return; }
    if(/add weekly task(?:s)?$/i.test(command)){ enterMultiTaskMode('weekly'); return; }

    // Multi-delete mode
    if(/delete multiple tasks?|remove multiple tasks?/i.test(command)){ enterMultiDeleteMode(); return; }

    // Edit task
    match=command.match(/(?:edit|rename)\s+(?:task\s+)?(.+)/i);
    if(match){ enterEditMode(match[1].trim()); return; }

    // Add single daily task (with optional time + priority inline)
    match=command.match(/add (?:a )?daily task(?:\s+called)?\s+(.+)/i);
    if(match){ addTaskVoice(match[1].trim(),'daily'); return; }

    match=command.match(/add (?:a )?weekly task(?:\s+called)?\s+(.+)/i);
    if(match){ addTaskVoice(match[1].trim(),'weekly'); return; }

    // Add generic task
    match=command.match(/(?:add(?: a)? task(?: called)?|create(?: a)? task(?: called)?)\s+(.+)/i);
    if(match){ addTaskVoice(match[1].trim()); return; }

    // Complete
    match=command.match(/(?:complete|mark|i completed|i finished)\s+(.+?)(?:\s+complete)?$/i);
    if(match){ completeTaskVoice(match[1].trim()); return; }

    // Delete single
    match=command.match(/(?:delete|remove)\s+(?:task\s+)?(.+)/i);
    if(match){ deleteTaskVoice(match[1].trim()); return; }

    // Clear completed
    if(/clear completed(?: tasks)?|remove completed(?: tasks)?|delete completed(?: tasks)?/i.test(command)){
        clearCompletedVoice(); return;
    }

    // Clear all
    if(/clear all(?: tasks)?|delete all(?: tasks)?|remove all(?: tasks)?/i.test(command)){
        clearAllTasksVoice(); return;
    }

    // Dark/light
    if(/switch to dark(?: mode)?|enable dark(?: mode)?|dark mode on/i.test(command)){ switchToDark(); return; }
    if(/switch to light(?: mode)?|enable light(?: mode)?|light mode on/i.test(command)){ switchToLight(); return; }

    // Brightness
    match=command.match(/set brightness to\s+(\d+)/i);
    if(match){ setBrightnessVoice(parseInt(match[1])); return; }

    // Summary
    if(/give(?: me)?(?: a)? summary|what(?:'s| is) my progress|show(?: me)?(?: my)? summary|progress report/i.test(command)){
        giveSummary(); return;
    }

    // Nav
    if(/show daily tasks|open daily tasks|daily tasks|switch to daily/i.test(command)){ openDailyTasks(); return; }
    if(/show weekly tasks|open weekly tasks|weekly tasks|switch to weekly/i.test(command)){ openWeeklyTasks(); return; }
    if(/what tasks do i have|show my tasks|show todays tasks|show today's tasks/i.test(command)){ showTasks(); return; }

    setStatus('Command Not Understood','error');
    speak('Command not understood');
}

recognition.onstart=()=>{ setStatus('Listening...','listening'); };

recognition.onresult=(event)=>{
    const transcript=event.results[0][0].transcript.toLowerCase().trim();
    setStatus('Processing...','processing');
    setTimeout(()=>{ processCommand(transcript); },200);
};

recognition.onerror=(event)=>{
    console.error(event.error);
    multiTaskMode=false; multiDeleteMode=false; editMode=false;
    switch(event.error){
        case 'not-allowed': setStatus('Microphone Permission Denied','error'); speak('Microphone permission denied'); break;
        case 'no-speech':   setStatus('No Speech Detected','error'); speak('No speech detected'); break;
        case 'audio-capture': setStatus('Microphone Not Found','error'); speak('Microphone not found'); break;
        default: setStatus('Voice Error','error'); speak('Voice error');
    }
};

recognition.onend=()=>{
    if(!multiTaskMode && !multiDeleteMode && !editMode){
        if(voiceStatus.textContent==='Listening...'||voiceStatus.textContent==='Processing...'){
            setStatus(sessionActive?'Ready':'Inactive');
        }
    }
};

voiceBtn.addEventListener('click',()=>{
    sessionActive=true;
    try{ recognition.start(); }
    catch(err){ console.error(err); }
});

setStatus('Inactive');

})();
