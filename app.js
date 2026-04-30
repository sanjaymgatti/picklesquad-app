/**
 * PickleSquad Standalone App Logic
 * Features: 4-day advance limit, Real-time Lobby, Auto-Waitlist
 */

// 1. INITIALIZATION
const SUPABASE_URL = 'https://luniefzosslboalopzhp.supabase.co/rest/v1/';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bmllZnpvc3NsYm9hbG9wemhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDU3NjYsImV4cCI6MjA5MzEyMTc2Nn0.ExuwRBGDBw4FU-ApoRO_59iP-H8x0vjDA_n72TJNOtk';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State management for the current session
let currentSessionId = new URLSearchParams(window.location.search).get('id');

window.onload = async () => {
    // If there's an ID in the URL, go straight to that session's lobby
    if (currentSessionId) {
        showLobby(currentSessionId);
    }
};

// 2. ORGANIZER LOGIC: CREATE SESSION
async function handleCreate() {
    const title = document.getElementById('title').value;
    const sDate = document.getElementById('date').value;
    const limit = parseInt(document.getElementById('limit').value);

    if (!title || !sDate || !limit) {
        alert("Please fill in all fields.");
        return;
    }

    // Date Validation: Only 4 days in advance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limitDate = new Date();
    limitDate.setDate(today.getDate() + 4);
    limitDate.setHours(23, 59, 59, 999);

    const chosenDate = new Date(sDate);

    if (chosenDate < today || chosenDate > limitDate) {
        alert("Error: You can only schedule games between today and the next 4 days.");
        return;
    }

    // Insert into Supabase
    const { data, error } = await _supabase
        .from('sessions')
        .insert([{ 
            title: title, 
            session_date: sDate, 
            max_players: limit 
        }])
        .select();

    if (error) {
        console.error(error);
        alert("Failed to create session.");
    } else if (data && data.length > 0) {
        // Redirect to the session's unique URL
        const shareLink = window.location.origin + window.location.pathname + "?id=" + data[0].id;
        window.location.href = shareLink;
    }
}

// 3. PLAYER LOGIC: JOIN & LOBBY
async function showLobby(id) {
    // Switch Views
    document.getElementById('view-organizer').classList.add('hidden');
    document.getElementById('view-lobby').classList.remove('hidden');

    // Fetch Session Details
    const { data: session, error: sError } = await _supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .single();

    if (sError || !session) {
        alert("Session not found or expired.");
        window.location.href = window.location.pathname; // Go back to creator
        return;
    }

    document.getElementById('session-info').innerHTML = `
        <h2 class="text-2xl font-black text-slate-800">${session.title}</h2>
        <p class="text-indigo-600 font-bold">${formatDate(session.session_date)}</p>
    `;

    // Initial load of players
    refreshPlayerList(id, session.max_players);
}

async function handleJoin() {
    const playerName = document.getElementById('playerName').value.trim();

    if (!playerName) {
        alert("Please enter your name.");
        return;
    }

    const { error } = await _supabase
        .from('participants')
        .insert([{ 
            session_id: currentSessionId, 
            player_name: playerName 
        }]);

    if (error) {
        alert("Error joining session. You might already be on the list.");
    } else {
        document.getElementById('playerName').value = ""; // Clear input
        // Refresh to show updated list
        const { data: session } = await _supabase.from('sessions').select('max_players').eq('id', currentSessionId).single();
        refreshPlayerList(currentSessionId, session.max_players);
    }
}

async function refreshPlayerList(sessionId, limit) {
    const { data: players, error } = await _supabase
        .from('participants')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    if (!error) {
        renderPlayers(players, limit);
    }
}

// 4. UI RENDERING
function renderPlayers(players, limit) {
    const list = document.getElementById('player-list');
    list.innerHTML = "";

    players.forEach((p, index) => {
        const isWaitlist = index >= limit;
        const div = document.createElement('div');
        
        // Add animation and styling
        div.className = `player-entry flex justify-between items-center p-4 rounded-xl mb-2 ${isWaitlist ? 'badge-waitlist' : 'badge-playing'}`;
        
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-xs font-bold opacity-50">${index + 1}</span>
                <span class="font-bold text-slate-800">${p.player_name}</span>
            </div>
            <span class="text-[9px] px-2 py-1 rounded-md uppercase font-black tracking-tighter">
                ${isWaitlist ? 'Waitlist' : 'Confirmed'}
            </span>
        `;
        list.appendChild(div);
    });

    if (players.length === 0) {
        list.innerHTML = `<p class="text-center text-slate-400 py-10 text-sm italic">No players joined yet. Be the first!</p>`;
    }
}

// 5. UTILITY FUNCTIONS
function formatDate(dateStr) {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString(undefined, options);
}

/**
 * CLEANUP UTILITY: Run this manually or via Cron
 * Deletes sessions older than 7 days
 */
async function cleanupOldData() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateString = sevenDaysAgo.toISOString().split('T')[0];

    await _supabase
        .from('sessions')
        .delete()
        .lt('session_date', dateString);
}