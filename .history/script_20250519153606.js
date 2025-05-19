import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://uvckphoyynzibfldjhft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2Y2twaG95eW56aWJmbGRqaGZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc2NDQ2OTIsImV4cCI6MjA2MzIyMDY5Mn0.b5prJX7zulVdkB3nmdF6Cl54tc_I62r764SoGZZ73-g';
const supabase = createClient(supabaseUrl, supabaseKey);

const authDiv = document.getElementById('auth');
const appDiv = document.getElementById('app');
const googleSigninBtn = document.getElementById('google-signin-btn');
const signoutBtn = document.getElementById('signout-btn');
const accessDeniedMsg = document.getElementById('access-denied');
const newTaskText = document.getElementById('new-task-text');
const addTaskBtn = document.getElementById('add-task-btn');
const tasksList = document.getElementById('tasks-list');

// Define a map for user IDs/emails to display names (customize these)
const userDisplayNameMap = {
    'juanfranbrv@gmail.com': 'Junafran',
    'user2@example.com': 'Usuario 2',
    'user3@example.com': 'Usuario 3'
    // Add more mappings as needed
};


// --- Authentication ---

async function signInWithGoogle() {
    const redirectUrl = window.location.origin;
    console.log('Redirecting to:', redirectUrl);
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUrl
        }
    });
    if (error) {
        console.error('Error signing in with Google:', error.message);
    }
}

async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error signing out:', error.message);
    }
}

supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        handleSignedInUser(session.user);
    } else {
        handleSignedOutUser();
    }
});

async function handleSignedInUser(user) {
    // Check if user email is in whitelist (RLS will handle actual data access)
    // For UI purposes, we can try fetching data and show access denied if it fails
    console.log('User signed in:', user);
    authDiv.classList.add('hidden');
    appDiv.classList.remove('hidden');
    accessDeniedMsg.classList.add('hidden'); // Hide access denied initially

    // Attempt to load tasks - RLS will determine if allowed
    loadTasks(user.email);
}

function handleSignedOutUser() {
    console.log('User signed out');
    authDiv.classList.remove('hidden');
    appDiv.classList.add('hidden');
    tasksList.innerHTML = ''; // Clear tasks list
    accessDeniedMsg.classList.add('hidden'); // Hide access denied
}

// --- Task Management (CRUD) ---

async function loadTasks(currentUserEmail) {
    const user = supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error loading tasks:', error.message);
        if (error.message.includes('permission denied')) { // Basic check for RLS denial
             accessDeniedMsg.classList.remove('hidden');
             tasksList.innerHTML = ''; // Clear tasks if access denied
        }
    } else {
        // Extract unique user IDs from tasks
        const userIds = new Set();
        data.forEach(task => {
            userIds.add(task.created_by_user_id);
            if (task.last_modified_by_user_id) {
                userIds.add(task.last_modified_by_user_id);
            }
        });

        // Fetch user emails for the extracted IDs
        const { data: usersData, error: usersError } = await supabase
            .from('users') // Reference public.users table
            .select('id, email')
            .in('id', Array.from(userIds));

        if (usersError) {
            console.error('Error fetching users:', usersError.message);
            displayTasks(data, {}); // Display tasks with IDs if user fetch fails
        } else {
            // Create a map of user ID to email
            const userEmailMap = usersData.reduce((map, user) => {
                map[user.id] = user.email;
                return map;
            }, {});
            displayTasks(data, userEmailMap, currentUserEmail); // Display tasks with emails
        }

        accessDeniedMsg.classList.add('hidden'); // Hide access denied if tasks loaded
    }
}

function displayTasks(tasks, userEmailMap, currentUserEmail) {
    tasksList.innerHTML = ''; // Clear current list
    tasks.forEach(task => {
        const createdByUserEmail = task.created_by_user_id === supabase.auth.user?.id ? currentUserEmail : userEmailMap[task.created_by_user_id] || 'Desconocido';
        const lastModifiedByUserEmail = task.last_modified_by_user_id === supabase.auth.user?.id ? currentUserEmail : userEmailMap[task.last_modified_by_user_id] || 'Desconocido';

        const createdByDisplayName = userDisplayNameMap[createdByUserEmail] || createdByUserEmail;
        const lastModifiedByDisplayName = userDisplayNameMap[lastModifiedByUserEmail] || lastModifiedByUserEmail;


        const taskElement = document.createElement('div');
        taskElement.classList.add('task-item', 'card', 'bg-base-100', 'shadow-xl', 'mb-4');
        taskElement.innerHTML = `
            <div class="card-body">
                <div class="flex items-center">
                    <input type="checkbox" class="checkbox mr-4" ${task.is_complete ? 'checked' : ''} data-id="${task.id}">
                    <span class="flex-grow ${task.is_complete ? 'line-through text-gray-500' : ''}">${task.task_text}</span>
                    <button class="btn btn-sm btn-ghost edit-task-btn" data-id="${task.id}">Editar</button>
                    <button class="btn btn-sm btn-ghost text-red-500 delete-task-btn" data-id="${task.id}">Eliminar</button>
                </div>
                <div class="text-xs text-gray-500 mt-2">
                    Creada por: ${createdByDisplayName} el ${new Date(task.created_at).toLocaleString()}
                    ${task.updated_at !== task.created_at ? `<br>Última modificación por: ${lastModifiedByDisplayName} el ${new Date(task.updated_at).toLocaleString()}` : ''}
                </div>
            </div>
        `;
        tasksList.appendChild(taskElement);
    });
}

async function addTask() {
    const taskText = newTaskText.value.trim();
    if (!taskText) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.id) {
        console.error('User not signed in or user ID not available.');
        return;
    }

    const { data, error } = await supabase
        .from('tasks')
        .insert([
            {
                task_text: taskText,
                owner_user_id: user.id,
                created_by_user_id: user.id
            }
        ]);

    if (error) {
        console.error('Error adding task:', error.message);
    } else {
        newTaskText.value = ''; // Clear input
        loadTasks(); // Reload tasks
    }
}

async function updateTaskStatus(taskId, isComplete) {
     const user = supabase.auth.getUser();
     if (!user) return;

    const { data, error } = await supabase
        .from('tasks')
        .update({
            is_complete: isComplete,
            last_modified_by_user_id: user.id,
            updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

    if (error) {
        console.error('Error updating task status:', error.message);
    } else {
        loadTasks(); // Reload tasks
    }
}

async function updateTaskText(taskId, newText) {
     const user = supabase.auth.getUser();
     if (!user) return;

    const { data, error } = await supabase
        .from('tasks')
        .update({
            task_text: newText,
            last_modified_by_user_id: user.id,
            updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

    if (error) {
        console.error('Error updating task text:', error.message);
    } else {
        loadTasks(); // Reload tasks
    }
}

async function deleteTask(taskId) {
    const { data, error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

    if (error) {
        console.error('Error deleting task:', error.message);
    } else {
        loadTasks(); // Reload tasks
    }
}


// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    googleSigninBtn.addEventListener('click', () => {
        console.log('Google sign-in button clicked');
        signInWithGoogle();
    });
    signoutBtn.addEventListener('click', signOut);
    addTaskBtn.addEventListener('click', addTask);

    tasksList.addEventListener('change', (event) => {
        if (event.target.type === 'checkbox' && event.target.classList.contains('checkbox')) {
            const taskId = event.target.dataset.id;
            const isComplete = event.target.checked;
            updateTaskStatus(taskId, isComplete);
        }
    });

    tasksList.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-task-btn')) {
            const taskId = event.target.dataset.id;
            deleteTask(taskId);
        }
        if (event.target.classList.contains('edit-task-btn')) {
            const taskId = event.target.dataset.id;
            // Implement edit functionality (e.g., show a modal or inline edit)
            console.log('Edit task with ID:', taskId);
            // For now, a simple prompt:
            const currentTaskElement = event.target.closest('.card-body').querySelector('span');
            const currentText = currentTaskElement.textContent;
            const newText = prompt('Editar tarea:', currentText);
            if (newText !== null && newText.trim() !== '' && newText.trim() !== currentText.trim()) {
                updateTaskText(taskId, newText.trim());
            }
        }
    });

    // Initial check on page load
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            handleSignedInUser(session.user);
        } else {
            handleSignedOutUser();
        }
    });
});
