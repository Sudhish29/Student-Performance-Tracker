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
  
  // Initialize Firebase (compat)
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  
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
    return String(text).replace(/[&<>"'`]/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[s]));
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
  
  // ---------------- Add / Update semester ----------------
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
    const studentId = name.toLowerCase().replace(/\s+/g,'_');
  
    try {
      const studentRef = db.collection('students').doc(studentId);
      await db.runTransaction(async tx => {
        const doc = await tx.get(studentRef);
        if(!doc.exists) tx.set(studentRef, { name });
        else tx.update(studentRef, { name });
        const semRef = studentRef.collection('semesters').doc(semester);
        tx.set(semRef, { ...subjectData, total, average, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
      });
      clearForm();
      showToast('Saved ✓');
    } catch (e) {
      console.error('Add semester error:', e);
      alert('Error saving data. See console.');
    }
  });
  
  // ---------------- Delete semester ----------------
  async function deleteSemester(studentId, semester){
    if(!confirm(`Delete ${semester} of this student? This cannot be undone.`)) return;
    try {
      const semId = (semester || '').trim();
      await db.collection('students').doc(studentId).collection('semesters').doc(semId).delete();
      showToast('Semester deleted');
    } catch(e){
      console.error('Delete semester error:', e);
      alert('Failed to delete semester. Check console.');
    }
  }
  
  // ---------------- Delete whole student (batched) ----------------
  async function deleteStudent(studentId){
    if(!confirm('Delete this student and ALL semester records? This cannot be undone.')) return;
    try {
      const studentRef = db.collection('students').doc(studentId);
      const semSnap = await studentRef.collection('semesters').get();
      const batch = db.batch();
      semSnap.forEach(d => batch.delete(d.ref));
      batch.delete(studentRef);
      await batch.commit();
      showToast('Student and all semesters deleted');
    } catch(e){
      console.error('Delete student error:', e);
      alert('Could not delete student. See console for details.');
    }
  }
  
  // expose globally so inline calls (if any) or console can use them
  window.deleteSemester = deleteSemester;
  window.deleteStudent = deleteStudent;
  
  // ---------------- Fill semester for edit ----------------
  window.fillSemesterForEdit = async function(studentId, semesterName){
    try {
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
    } catch(e){
      console.error('fillSemesterForEdit error:', e);
      alert('Could not load semester for edit.');
    }
  };
  
  // ---------------- Render students (Option B: programmatic buttons) ----------------
  function renderStudents(snapshot){
    recordsArea.innerHTML = '';
  
    if(!snapshot || snapshot.empty){
      recordsArea.innerHTML = '<div style="color:#6b7280">No students yet. Add one using the form above.</div>';
      return;
    }
  
    snapshot.forEach(studentDoc => {
      const student = studentDoc.data() || {};
      const sid = studentDoc.id;
  
      // student block
      const block = document.createElement('div');
      block.className = 'student-block';
  
      // header
      const header = document.createElement('div');
      header.className = 'student-header';
  
      const nameEl = document.createElement('div');
      nameEl.className = 'student-name';
      nameEl.textContent = student.name || sid;
  
      const metaEl = document.createElement('div');
      metaEl.className = 'student-meta';
  
      // create programmatic buttons (Fill name + Delete Student)
      const fillBtn = document.createElement('button');
      fillBtn.className = 'btn-mini';
      fillBtn.textContent = 'Fill Name';
      fillBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        document.getElementById('studentName').value = student.name || '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
  
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-mini btn-danger';
      deleteBtn.textContent = 'Delete Student';
      deleteBtn.addEventListener('click', async (ev) => {
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
  
      // semesters container
      const semListWrap = document.createElement('div');
      semListWrap.className = 'sem-list';
      block.appendChild(semListWrap);
  
      // fetch semesters for this student and render
      studentDoc.ref.collection('semesters').orderBy('updatedAt','desc').get().then(ss => {
        if(ss.empty){
          semListWrap.innerHTML = '<div class="student-meta">No semester records yet.</div>';
          recordsArea.appendChild(block);
          return;
        }
  
        // Build header grid for fixed 6-subject layout
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
  
          // build row HTML safely
          const semIdEsc = escapeHtml(doc.id);
          const mathVal = d.math ?? 0;
          const phyVal = d.physics ?? 0;
          const chemVal = d.chemistry ?? (d.chem ?? 0);
          const bioVal = d.biology ?? 0;
          const engVal = d.english ?? 0;
          const compVal = d.computer ?? 0;
          const totalVal = d.total ?? 0;
          const avgVal = d.average ?? '0.00';
  
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
  
          // attach programmatic handlers for edit & delete to avoid inline onclick issues
          // edit button
          semListWrap.appendChild(semRow);
  
          // after appended, attach events
          const editBtn = semRow.querySelector('button[data-edit]');
          const delBtnS = semRow.querySelector('button[data-delete]');
  
          if(editBtn){
            editBtn.addEventListener('click', (ev)=>{
              ev.stopPropagation();
              fillSemesterForEdit(sid, doc.id);
            });
          }
          if(delBtnS){
            delBtnS.addEventListener('click', async (ev)=>{
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
      }).catch(e=>{
        console.error('read sems error', e);
        semListWrap.innerHTML = '<div class="student-meta">Could not load semesters.</div>';
        recordsArea.appendChild(block);
      });
    });
  }
  
  // ---------------- Real-time listener ----------------
  db.collection('students').orderBy('name').onSnapshot(snapshot => {
    renderStudents(snapshot);
  }, err => {
    console.error('snapshot err', err);
    recordsArea.innerHTML = '<div style="color:#b91c1c">Could not load students. Check console.</div>';
  });
  
  // Ensure functions reachable from console / inline
  window.deleteStudent = deleteStudent;
  window.deleteSemester = deleteSemester;
  window.fillSemesterForEdit = fillSemesterForEdit;
  