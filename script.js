// script.js - COMPLETE (copy-paste into your project)
// Firebase config (you provided this) -------------------------
const firebaseConfig = {
    apiKey: "AIzaSyBaeWhsQc0OpPcQ_0VnLg98fGA4xsnYBxo",
    authDomain: "student-performance-trac-54a03.firebaseapp.com",
    projectId: "student-performance-trac-54a03",
    storageBucket: "student-performance-trac-54a03.firebasestorage.app",
    messagingSenderId: "56784963862",
    appId: "1:56784963862:web:48cc404bc71c8980b4e837"
};
// -------------------------------------------------------------

const LOCAL_STORAGE_KEY = 'student_performance_tracker_data';
let usingLocalStorage = false;
let db;

try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
} catch (e) {
  console.error('Firebase init error:', e);
  usingLocalStorage = true;
}

// DOM references (these IDs must match your index.html)
const studentNameEl = document.getElementById('studentName');
const semesterEl = document.getElementById('semesterSelect');
const fields = {
  math: document.getElementById('s_math'),
  physics: document.getElementById('s_physics'),
  chem: document.getElementById('s_chem'),
  bio: document.getElementById('s_bio'),
  eng: document.getElementById('s_eng'),
  comp: document.getElementById('s_comp')
};
const btnAdd = document.getElementById('btnAddSemester');
const btnClear = document.getElementById('btnClear');
const recordsArea = document.getElementById('recordsArea');

// ---------------- helpers ----------------
function escapeHtml(text){
  if(!text) return '';
  return String(text).replace(/[&<>"'`]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[s]));
}
function escapeAttr(t){ return (t||'').replace(/'/g,"\\'"); }

function showToast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style,{
    position:'fixed', right:'18px', bottom:'18px', background:'#1e90ff',
    color:'#fff', padding:'10px 14px', borderRadius:'8px', boxShadow:'0 6px 18px rgba(0,0,0,0.2)', zIndex:9999
  });
  document.body.appendChild(t);
  setTimeout(()=> t.remove(),1400);
}

function computeValues(values){
  const vals = Object.values(values).map(v => Number(v) || 0);
  const total = vals.reduce((a,b)=>a+b,0);
  const average = vals.length ? Number((total/vals.length).toFixed(2)) : 0;
  return { total, average };
}

function clearForm(){
  studentNameEl.value = '';
  Object.values(fields).forEach(f => f.value = '');
  if(semesterEl) semesterEl.value = semesterEl.options[0]?.value || '';
}

function getLocalData(){
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  try { return raw ? JSON.parse(raw) : {}; } catch(e){ console.warn('Local data parse failed', e); return {}; }
}

function setLocalData(data){
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}

function getStudentId(name){
  return name.trim().toLowerCase().replace(/\s+/g,'_');
}

function getOrCreateLocalStudent(data, studentId, name){
  if(!data[studentId]) data[studentId] = { name, semesters: {} };
  else data[studentId].name = name || data[studentId].name;
  return data[studentId];
}

function formatAverage(value){
  return (typeof value === 'number' ? value : Number(value || 0)).toFixed(2);
}

function renderLocalStudents(){
  const data = getLocalData();
  const studentIds = Object.keys(data).sort((a,b)=> (data[a].name || a).localeCompare(data[b].name || b));
  recordsArea.innerHTML = '';
  if(studentIds.length === 0){
    recordsArea.innerHTML = '<div style="color:#6b7280">No students yet. Add one using the form above.</div>';
    return;
  }

  studentIds.forEach(sid => {
    const student = data[sid] || { name: sid, semesters: {} };
    const block = document.createElement('div');
    block.className = 'student-block';

    const header = document.createElement('div');
    header.className = 'student-header';

    const nameEl = document.createElement('div');
    nameEl.className = 'student-name';
    nameEl.textContent = student.name || sid;

    const metaEl = document.createElement('div');
    metaEl.className = 'student-meta';

    const fillBtn = document.createElement('button');
    fillBtn.className = 'btn-mini';
    fillBtn.textContent = 'Fill Name';
    fillBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      document.getElementById('studentName').value = student.name || '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-mini btn-danger';
    deleteBtn.textContent = 'Delete Student';
    deleteBtn.addEventListener('click', async ev => {
      ev.stopPropagation();
      const ok = confirm(`Delete student "${student.name || sid}" and ALL semesters?`);
      if(!ok) return;
      try {
        await deleteStudent(sid);
      } catch(err){
        console.error('delete button error', err);
        alert('Could not delete student. See console.');
      }
    });

    metaEl.appendChild(fillBtn);
    metaEl.appendChild(deleteBtn);
    header.appendChild(nameEl);
    header.appendChild(metaEl);
    block.appendChild(header);

    const semListWrap = document.createElement('div');
    semListWrap.className = 'sem-list';
    block.appendChild(semListWrap);

    const semesters = Object.entries(student.semesters || {}).sort((a,b) => a[0].localeCompare(b[0]));
    if(semesters.length === 0){
      semListWrap.innerHTML = '<div class="student-meta">No semester records yet.</div>';
      recordsArea.appendChild(block);
      return;
    }

    const thead = document.createElement('div');
    thead.style.display = 'grid';
    thead.style.gridTemplateColumns = 'repeat(9,1fr)';
    thead.style.gap = '6px';
    thead.style.padding = '6px';
    thead.style.background = '#f8fafc';
    thead.style.fontWeight = '700';
    thead.innerHTML = `
      <div>Semester</div>
      <div>Mathematics</div>
      <div>Physics</div>
      <div>Chemistry</div>
      <div>Biology</div>
      <div>English</div>
      <div>Computer</div>
      <div>Total</div>
      <div>Avg & Actions</div>
    `;
    semListWrap.appendChild(thead);

    semesters.forEach(([semId, d]) => {
      const semRow = document.createElement('div');
      semRow.className = 'sem-grid';
      semRow.style.display = 'grid';
      semRow.style.gridTemplateColumns = 'repeat(9,1fr)';
      semRow.style.gap = '6px';
      semRow.style.alignItems = 'center';
      semRow.style.padding = '8px 6px';
      semRow.style.borderBottom = '1px solid #f1f5f9';

      const mathVal = d.math ?? 0;
      const phyVal = d.physics ?? 0;
      const chemVal = d.chemistry ?? (d.chem ?? 0);
      const bioVal = d.biology ?? 0;
      const engVal = d.english ?? 0;
      const compVal = d.computer ?? 0;
      const totalVal = d.total ?? 0;
      const avgVal = formatAverage(d.average);

      semRow.innerHTML = `
        <div>${escapeHtml(semId)}</div>
        <div>${mathVal}</div>
        <div>${phyVal}</div>
        <div>${chemVal}</div>
        <div>${bioVal}</div>
        <div>${engVal}</div>
        <div>${compVal}</div>
        <div>${totalVal}</div>
        <div style="display:flex;gap:8px;align-items:center;justify-content:flex-end">
          <div style="font-weight:700;margin-right:8px">${avgVal}</div>
          <button class="btn-mini" data-edit="${escapeAttr(semId)}">Edit</button>
          <button class="btn-mini btn-danger" data-delete="${escapeAttr(semId)}">Delete</button>
        </div>
      `;

      semListWrap.appendChild(semRow);
      const editBtn = semRow.querySelector('button[data-edit]');
      const delBtnS = semRow.querySelector('button[data-delete]');

      if(editBtn){
        editBtn.addEventListener('click', ev => {
          ev.stopPropagation();
          fillSemesterForEdit(sid, semId);
        });
      }
      if(delBtnS){
        delBtnS.addEventListener('click', async ev => {
          ev.stopPropagation();
          const ok = confirm(`Delete ${semId} of student ${student.name || sid}?`);
          if(!ok) return;
          try {
            await deleteSemester(sid, semId);
          } catch(err){
            console.error('semester delete error', err);
            alert('Could not delete semester. See console.');
          }
        });
      }
    });

    recordsArea.appendChild(block);
  });
}

function renderStudents(snapshot){
  recordsArea.innerHTML = '';

  if(!snapshot || snapshot.empty){
    recordsArea.innerHTML = '<div style="color:#6b7280">No students yet. Add one using the form above.</div>';
    return;
  }

  snapshot.forEach(studentDoc => {
    const student = studentDoc.data() || {};
    const sid = studentDoc.id;

    const block = document.createElement('div');
    block.className = 'student-block';

    const header = document.createElement('div');
    header.className = 'student-header';

    const nameEl = document.createElement('div');
    nameEl.className = 'student-name';
    nameEl.textContent = student.name || sid;

    const metaEl = document.createElement('div');
    metaEl.className = 'student-meta';

    const fillBtn = document.createElement('button');
    fillBtn.className = 'btn-mini';
    fillBtn.textContent = 'Fill Name';
    fillBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      document.getElementById('studentName').value = student.name || '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-mini btn-danger';
    deleteBtn.textContent = 'Delete Student';
    deleteBtn.addEventListener('click', async ev => {
      ev.stopPropagation();
      const ok = confirm(`Delete student "${student.name || sid}" and ALL semesters?`);
      if(!ok) return;
      try {
        await deleteStudent(sid);
      } catch(err){
        console.error('delete button error', err);
        alert('Could not delete student. See console.');
      }
    });

    metaEl.appendChild(fillBtn);
    metaEl.appendChild(deleteBtn);
    header.appendChild(nameEl);
    header.appendChild(metaEl);
    block.appendChild(header);

    const semListWrap = document.createElement('div');
    semListWrap.className = 'sem-list';
    block.appendChild(semListWrap);

    studentDoc.ref.collection('semesters').orderBy('updatedAt','desc').get().then(ss => {
      if(ss.empty){
        semListWrap.innerHTML = '<div class="student-meta">No semester records yet.</div>';
        recordsArea.appendChild(block);
        return;
      }

      const thead = document.createElement('div');
      thead.style.display = 'grid';
      thead.style.gridTemplateColumns = 'repeat(9,1fr)';
      thead.style.gap = '6px';
      thead.style.padding = '6px';
      thead.style.background = '#f8fafc';
      thead.style.fontWeight = '700';
      thead.innerHTML = `
        <div>Semester</div>
        <div>Mathematics</div>
        <div>Physics</div>
        <div>Chemistry</div>
        <div>Biology</div>
        <div>English</div>
        <div>Computer</div>
        <div>Total</div>
        <div>Avg & Actions</div>
      `;
      semListWrap.appendChild(thead);

      ss.forEach(doc => {
        const d = doc.data() || {};
        const semRow = document.createElement('div');
        semRow.className = 'sem-grid';
        semRow.style.display = 'grid';
        semRow.style.gridTemplateColumns = 'repeat(9,1fr)';
        semRow.style.gap = '6px';
        semRow.style.alignItems = 'center';
        semRow.style.padding = '8px 6px';
        semRow.style.borderBottom = '1px solid #f1f5f9';

        const semIdEsc = escapeHtml(doc.id);
        const mathVal = d.math ?? 0;
        const phyVal = d.physics ?? 0;
        const chemVal = d.chemistry ?? (d.chem ?? 0);
        const bioVal = d.biology ?? 0;
        const engVal = d.english ?? 0;
        const compVal = d.computer ?? 0;
        const totalVal = d.total ?? 0;
        const avgVal = formatAverage(d.average);

        semRow.innerHTML = `
          <div>${semIdEsc}</div>
          <div>${mathVal}</div>
          <div>${phyVal}</div>
          <div>${chemVal}</div>
          <div>${bioVal}</div>
          <div>${engVal}</div>
          <div>${compVal}</div>
          <div>${totalVal}</div>
          <div style="display:flex;gap:8px;align-items:center;justify-content:flex-end">
            <div style="font-weight:700;margin-right:8px">${avgVal}</div>
            <button class="btn-mini" data-edit="${escapeAttr(doc.id)}">Edit</button>
            <button class="btn-mini btn-danger" data-delete="${escapeAttr(doc.id)}">Delete</button>
          </div>
        `;

        semListWrap.appendChild(semRow);
        const editBtn = semRow.querySelector('button[data-edit]');
        const delBtnS = semRow.querySelector('button[data-delete]');

        if(editBtn){
          editBtn.addEventListener('click', ev => {
            ev.stopPropagation();
            fillSemesterForEdit(sid, doc.id);
          });
        }
        if(delBtnS){
          delBtnS.addEventListener('click', async ev => {
            ev.stopPropagation();
            const ok = confirm(`Delete ${doc.id} of student ${student.name || sid}?`);
            if(!ok) return;
            try {
              await deleteSemester(sid, doc.id);
            } catch(err){
              console.error('semester delete error', err);
              alert('Could not delete semester. See console.');
            }
          });
        }
      });

      recordsArea.appendChild(block);
    }).catch(e => {
      console.error('read sems error', e);
      semListWrap.innerHTML = '<div class="student-meta">Could not load semesters.</div>';
      recordsArea.appendChild(block);
    });
  });
}

btnAdd.addEventListener('click', async () => {
  const name = (studentNameEl.value || '').trim();
  const semester = (semesterEl && semesterEl.value) ? semesterEl.value : 'Semester 1';
  if(!name) return alert('Enter student full name.');

  const subjectData = {
    math: Number(fields.math?.value) || 0,
    physics: Number(fields.physics?.value) || 0,
    chemistry: Number(fields.chem?.value) || 0,
    biology: Number(fields.bio?.value) || 0,
    english: Number(fields.eng?.value) || 0,
    computer: Number(fields.comp?.value) || 0
  };
  const { total, average } = computeValues(subjectData);
  const studentId = getStudentId(name);

  try {
    if(!usingLocalStorage){
      const studentRef = db.collection('students').doc(studentId);
      await db.runTransaction(async tx => {
        const doc = await tx.get(studentRef);
        if(!doc.exists) tx.set(studentRef, { name });
        else tx.update(studentRef, { name });
        const semRef = studentRef.collection('semesters').doc(semester);
        tx.set(semRef, { ...subjectData, total, average, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
      });
    } else {
      const data = getLocalData();
      const student = getOrCreateLocalStudent(data, studentId, name);
      student.semesters[semester] = { ...subjectData, total, average, updatedAt: new Date().toISOString() };
      setLocalData(data);
      renderLocalStudents();
    }
    clearForm();
    showToast('Saved ✓');
  } catch (e) {
    console.error('Add semester error:', e);
    if(e && e.code === 'permission-denied'){
      usingLocalStorage = true;
      const data = getLocalData();
      const student = getOrCreateLocalStudent(data, studentId, name);
      student.semesters[semester] = { ...subjectData, total, average, updatedAt: new Date().toISOString() };
      setLocalData(data);
      renderLocalStudents();
      clearForm();
      showToast('Saved locally; Firestore permissions blocked.');
      return;
    }
    alert('Error saving data. See console.');
  }
});

btnClear.addEventListener('click', clearForm);

async function deleteSemester(studentId, semester){
  if(!confirm(`Delete ${semester} of this student? This cannot be undone.`)) return;
  try {
    if(!usingLocalStorage){
      const semId = (semester || '').trim();
      await db.collection('students').doc(studentId).collection('semesters').doc(semId).delete();
    } else {
      const data = getLocalData();
      const student = data[studentId];
      if(student && student.semesters){
        delete student.semesters[semester];
        setLocalData(data);
        renderLocalStudents();
      }
    }
    showToast('Semester deleted');
  } catch(e){
    console.error('Delete semester error:', e);
    if(e && e.code === 'permission-denied'){
      usingLocalStorage = true;
      alert('Firestore blocked. Switched to local mode. Please retry delete.');
      renderLocalStudents();
      return;
    }
    alert('Failed to delete semester. Check console.');
  }
}

async function deleteStudent(studentId){
  if(!confirm('Delete this student and ALL semester records? This cannot be undone.')) return;
  try {
    if(!usingLocalStorage){
      const studentRef = db.collection('students').doc(studentId);
      const semSnap = await studentRef.collection('semesters').get();
      const batch = db.batch();
      semSnap.forEach(d => batch.delete(d.ref));
      batch.delete(studentRef);
      await batch.commit();
    } else {
      const data = getLocalData();
      delete data[studentId];
      setLocalData(data);
      renderLocalStudents();
    }
    showToast('Student and all semesters deleted');
  } catch(e){
    console.error('Delete student error:', e);
    if(e && e.code === 'permission-denied'){
      usingLocalStorage = true;
      alert('Firestore blocked. Switched to local mode. Please retry delete.');
      renderLocalStudents();
      return;
    }
    alert('Could not delete student. See console for details.');
  }
}

window.deleteSemester = deleteSemester;
window.deleteStudent = deleteStudent;

window.fillSemesterForEdit = async function(studentId, semesterName){
  try {
    if(!usingLocalStorage){
      const sref = db.collection('students').doc(studentId);
      const sdoc = await sref.get();
      studentNameEl.value = sdoc.exists ? (sdoc.data().name || studentId.replace(/_/g,' ')) : studentId.replace(/_/g,' ');
      if(semesterEl) semesterEl.value = semesterName;
      const semSnap = await sref.collection('semesters').doc(semesterName).get();
      if(semSnap.exists){
        const d = semSnap.data();
        fields.math.value = d.math ?? 0;
        fields.physics.value = d.physics ?? 0;
        fields.chem.value = d.chemistry ?? (d.chem ?? 0);
        fields.bio.value = d.biology ?? 0;
        fields.eng.value = d.english ?? 0;
        fields.comp.value = d.computer ?? 0;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert('Semester data not found.');
      }
    } else {
      const data = getLocalData();
      const student = data[studentId] || { semesters: {} };
      studentNameEl.value = student.name || studentId.replace(/_/g,' ');
      if(semesterEl) semesterEl.value = semesterName;
      const sem = (student.semesters || {})[semesterName];
      if(sem){
        fields.math.value = sem.math ?? 0;
        fields.physics.value = sem.physics ?? 0;
        fields.chem.value = sem.chemistry ?? (sem.chem ?? 0);
        fields.bio.value = sem.biology ?? 0;
        fields.eng.value = sem.english ?? 0;
        fields.comp.value = sem.computer ?? 0;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert('Semester data not found.');
      }
    }
  } catch(e){
    console.error('fillSemesterForEdit error:', e);
    if(e && e.code === 'permission-denied'){
      usingLocalStorage = true;
      alert('Firestore blocked. Switched to local mode. Please retry edit.');
      renderLocalStudents();
      return;
    }
    alert('Could not load semester for edit.');
  }
};

function initializeApp(){
  if(usingLocalStorage){
    recordsArea.innerHTML = '<div style="color:#b9730b">Firestore is unavailable or blocked. Using local storage mode.</div>';
    renderLocalStudents();
    return;
  }

  db.collection('students').orderBy('name').onSnapshot(snapshot => {
    renderStudents(snapshot);
  }, err => {
    console.error('snapshot err', err);
    usingLocalStorage = true;
    recordsArea.innerHTML = '<div style="color:#b9730b">Firestore unavailable. Switched to local storage mode.</div>';
    renderLocalStudents();
  });
}

initializeApp();
