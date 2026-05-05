const SUPABASE_URL = 'https://luniefzosslboalopzhp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bmllZnpvc3NsYm9hbG9wemhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDU3NjYsImV4cCI6MjA5MzEyMTc2Nn0.ExuwRBGDBw4FU-ApoRO_59iP-H8x0vjDA_n72TJNOtk';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentSessionId = null;

// --- 1. AUTHENTICATION LOGIC ---

_supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    if (currentUser) {
        showView('view-dashboard');
        switchTab('all');
    } else {
        showView('view-auth');
    }
});

async function handleAuth() {
    const email = document.getElementById('auth-email').value;
    const { error } = await _supabase.auth.signInWithOtp({ 
        email,
        options: { emailRedirectTo: window.location.origin }
    });
    if (error) alert(error.message);
    else alert("Magic link sent! Check your email.");
}

async function handleLogout() {
    await _supabase.auth.signOut();
    window.location.href = window.location.origin;
}

// --- 2. NAVIGATION & TABS ---

function showView(viewId) {
    ['view-auth', 'view-dashboard', 'view-lobby'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active', 'text-slate-900'));
    
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    document.getElementById(`btn-${tab}`).classList.add('tab-active');

    if (tab === 'all') loadAllSessions();
    if (tab === 'mine') loadMySessions();
}

// --- 3. SESSION LOGIC ---

async function handleCreateSession() {
    const title = document.getElementById('new-title').value;
    const date = document.getElementById('new-date').value;
    const limit = parseInt(document.getElementById('new-limit').value);

    const { data, error } = await _supabase.from('sessions').insert([
        { title, session_date: date, max_players: limit, created_by: currentUser.id }
    ]).select();

    if (error) alert(error.message);
    else {
        alert("Session Created!");
        switchTab('mine');
    }
}

async function loadAllSessions() {
    const { data } = await _supabase.from('sessions').select('*').order('session_date', { ascending: true });
    renderList(data, 'list-all');
}

async function loadMySessions() {
    const { data } = await _supabase.from('sessions').select('*').eq('created_by', currentUser.id);
    renderList(data, 'list-mine');
}

function renderList(sessions, elementId) {
    const container = document.getElementById(elementId);
    container.innerHTML = sessions.length ? '' : '<p class="text-slate-400 italic">No sessions found.</p>';
    
    sessions.forEach(s => {
        const div = document.createElement('div');
        div.className = "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:border-indigo-300";
        div.onclick = () => openLobby(s.id);
        div.innerHTML = `
            <div>
                <h4 class="font-bold">${s.title}</h4>
                <p class="text-xs text-slate-500">${new Date(s.session_date).toDateString()}</p>
            </div>
            <span class="text-indigo-600 font-bold">→</span>
        `;
        container.appendChild(div);
    });
}

// --- 4. LOBBY & JOIN/UNJOIN LOGIC ---

async function openLobby(id) {
    currentSessionId = id;
    showView('view-lobby');
    
    const { data: session } = await _supabase.from('sessions').select('*').eq('id', id).single();
    const { data: players } = await _supabase.from('participants').select('*').eq('session_id', id).order('created_at', { ascending: true });

    document.getElementById('lobby-header').innerHTML = `
        <h2 class="text-3xl font-black">${session.title}</h2>
        <p class="text-indigo-600 font-bold">${new Date(session.session_date).toDateString()}</p>
    `;

    const userJoined = players.find(p => p.user_id === currentUser.id);
    const joinBtn = document.getElementById('btn-join-action');
    
    if (userJoined) {
        joinBtn.innerText = "Unjoin Session";
        joinBtn.className = "w-full py-4 rounded-2xl font-bold text-white bg-red-500";
    } else {
        joinBtn.innerText = "Join Squad";
        joinBtn.className = "w-full py-4 rounded-2xl font-bold text-white bg-indigo-600";
    }

    renderPlayers(players, session.max_players);
}

async function toggleJoin() {
    // 1. Get the current list of players for this session
    const { data: players, error: fetchError } = await _supabase
        .from('participants')
        .select('*')
        .eq('session_id', currentSessionId);

    if (fetchError) {
        alert("Error fetching players: " + fetchError.message);
        return;
    }

    const userEntry = players.find(p => p.user_id === currentUser.id);

    if (userEntry) {
        // UNJOIN Logic
        const { error: deleteError } = await _supabase
            .from('participants')
            .delete()
            .eq('id', userEntry.id);
            
        if (deleteError) alert("Could not unjoin: " + deleteError.message);
    } else {
        // JOIN Logic
        const name = currentUser.email.split('@')[0];
        const { error: insertError } = await _supabase
            .from('participants')
            .insert([{ 
                session_id: currentSessionId, 
                player_name: name, 
                user_id: currentUser.id 
            }]);
            
        if (insertError) alert("Could not join: " + insertError.message);
    }
    
    // Refresh the view regardless of outcome to show current state
    openLobby(currentSessionId);
}

function renderPlayers(players, limit) {
    const list = document.getElementById('player-list');
    list.innerHTML = "";
    players.forEach((p, i) => {
        const isWaitlist = i >= limit;
        const div = document.createElement('div');
        div.className = `p-4 rounded-xl flex justify-between ${isWaitlist ? 'bg-amber-50 text-amber-700' : 'bg-slate-100'}`;
        div.innerHTML = `<span>${i+1}. <b>${p.player_name}</b></span> <span class="text-[10px] uppercase font-black">${isWaitlist ? 'Waitlist' : 'Confirmed'}</span>`;
        list.appendChild(div);
    });
}
