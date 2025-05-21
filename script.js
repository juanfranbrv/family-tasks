import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://uvckphoyynzibfldjhft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2Y2twaG95eW56aWJmbGRqaGZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc2NDQ2OTIsImV4cCI6MjA2MzIyMDY5Mn0.b5prJX7zulVdkB3nmdF6Cl54tc_I62r764SoGZZ73-g';
const supabase = createClient(supabaseUrl, supabaseKey);

// DOM Elements
const authDiv = document.getElementById('auth');
const appDiv = document.getElementById('app');
const googleSigninBtn = document.getElementById('google-signin-btn');
const signoutBtn = document.getElementById('signout-btn');
const accessDeniedMsg = document.getElementById('access-denied');
const newTaskText = document.getElementById('new-task-text');
const addTaskBtn = document.getElementById('add-task-btn');
const tasksList = document.getElementById('tasks-list');
const avatarContainer = document.getElementById('avatar-container');
const loadingIndicator = document.getElementById('loading-indicator');
const emptyState = document.getElementById('empty-state');
const editModal = document.getElementById('edit-modal');
const editTaskInput = document.getElementById('edit-task-input');
const editTaskId = document.getElementById('edit-task-id');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const saveEditBtn = document.getElementById('save-edit-btn');
const userInfoContainer = document.querySelector('.user-info');

// Define a map for user IDs/emails to display names (customize these)
const userDisplayNameMap = {
    'juanfranbrv@gmail.com': 'Juanfran',
    'vicentbriva@gmail.com': 'Vicent',
    'emiglesi@gmail.com': 'Emi'
    // Add more mappings as needed
};

// Modal handling functions
function showEditModal(taskId, currentText) {
    editTaskId.value = taskId;
    editTaskInput.value = currentText;
    editModal.classList.add('modal-open');
    editTaskInput.focus();
}

function hideEditModal() {
    editModal.classList.remove('modal-open');
}

// --- Authentication ---

async function signInWithGoogle() {
    // Asegurarse de obtener la ruta completa, incluida la subcarpeta
    const redirectUrl = window.location.href.split('?')[0].split('#')[0]; // Elimina parámetros y hash
    console.log('Redirecting to:', redirectUrl);
    loadingIndicator.classList.remove('hidden');
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUrl
        }
    });
    if (error) {
        console.error('Error signing in with Google:', error.message);
        loadingIndicator.classList.add('hidden');
    }
}

async function signOut() {
    loadingIndicator.classList.remove('hidden');
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error signing out:', error.message);
    }
    loadingIndicator.classList.add('hidden');
}

supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        handleSignedInUser(session.user);
    } else {
        handleSignedOutUser();
    }
});

async function handleSignedInUser(user) {
    console.log('User signed in:', user);

    // Define the whitelist based on the userDisplayNameMap keys
    const whitelistEmails = Object.keys(userDisplayNameMap);

    // Check if user email is in whitelist
    if (!whitelistEmails.includes(user.email)) {
        console.warn('Access denied for user:', user.email);
        authDiv.classList.remove('hidden');
        appDiv.classList.add('hidden');
        accessDeniedMsg.classList.remove('hidden'); // Show access denied
        avatarContainer.classList.add('hidden'); // Hide avatar
        avatarContainer.innerHTML = ''; // Clear avatar content
        // signOut(); // Removed immediate sign out
        return; // Stop further processing for unauthorized users
    }

    // If user is in whitelist, proceed with displaying the app
    authDiv.classList.add('hidden');
    appDiv.classList.remove('hidden');
    accessDeniedMsg.classList.add('hidden'); // Hide access denied

    // Display avatar
    avatarContainer.classList.remove('hidden');
    if (user.user_metadata && user.user_metadata.avatar_url) {
        avatarContainer.innerHTML = `<img src="${user.user_metadata.avatar_url}" alt="Avatar" class="user-avatar">`;
    } else {
        // Display initials as fallback
        const initials = user.email.charAt(0).toUpperCase();
        avatarContainer.innerHTML = `
            <div class="user-avatar bg-white flex items-center justify-center font-bold" style="background-color: var(--mint-green); color: var(--indigo-dye);">
                ${initials}
            </div>
        `;
    }

    // Update user info in dropdown
    const displayName = userDisplayNameMap[user.email] || user.email;
    if (userInfoContainer) {
        userInfoContainer.innerHTML = `
        <span class="block font-medium text-base">${displayName}</span>
        <span class="block text-gray-500 text-sm overflow-hidden text-ellipsis">${user.email}</span>
        `;
    }

    // Attempt to load tasks - RLS will determine if allowed
    loadTasks(user.email);
}

function handleSignedOutUser() {
    console.log('User signed out');
    authDiv.classList.remove('hidden');
    appDiv.classList.add('hidden');
    tasksList.innerHTML = ''; // Clear tasks list
    accessDeniedMsg.classList.add('hidden'); // Hide access denied
    avatarContainer.classList.add('hidden'); // Hide avatar
    avatarContainer.innerHTML = ''; // Clear avatar content
    loadingIndicator.classList.add('hidden');
}

// --- Task Management (CRUD) ---

async function loadTasks(currentUserEmail) {
    loadingIndicator.classList.remove('hidden');
    
    const user = supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
        .from('tasks')
        .select('*, owner_user_id, created_by_user_id, last_modified_by_user_id')
        .order('order', { ascending: true })
        .order('created_at', { ascending: true });

    loadingIndicator.classList.add('hidden');

    if (error) {
        console.error('Error loading tasks:', error.message);
        if (error.message.includes('permission denied')) {
             accessDeniedMsg.classList.remove('hidden');
             tasksList.innerHTML = '';
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

        // If tasks are loaded for the first time and have no order, set a default order
        if (data && data.length > 0 && data.every(task => task.order === null)) {
            console.log('Setting initial order for tasks...');
            const updates = data.map((task, index) => ({
                id: task.id,
                order: index
            }));
            const { error: updateError } = await supabase
                .from('tasks')
                .upsert(updates);

            if (updateError) {
                console.error('Error setting initial order:', updateError.message);
            } else {
                // Reload tasks after setting initial order
                loadTasks(currentUserEmail);
                return;
            }
        }

        // Fetch user emails for the extracted IDs
        const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, email')
            .in('id', Array.from(userIds));

        if (usersError) {
            console.error('Error fetching users:', usersError.message);
            displayTasks(data, {});
        } else {
            // Create a map of user ID to email
            const userEmailMap = usersData.reduce((map, user) => {
                map[user.id] = user.email;
                return map;
            }, {});
            displayTasks(data, userEmailMap, currentUserEmail);
        }

        accessDeniedMsg.classList.add('hidden');
        
        // Show/hide empty state
        if (data.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
        }
    }
}

function displayTasks(tasks, userEmailMap, currentUserEmail) {
    tasksList.innerHTML = ''; // Clear current list
    
    tasks.forEach(task => {
        const createdByUserEmail = userEmailMap[task.created_by_user_id] || 'Desconocido';
        const lastModifiedByUserEmail = userEmailMap[task.last_modified_by_user_id] || 'Desconocido';

        const createdByDisplayName = userDisplayNameMap[createdByUserEmail] || createdByUserEmail;
        const lastModifiedByDisplayName = userDisplayNameMap[lastModifiedByUserEmail] || lastModifiedByUserEmail;

        const taskElement = document.createElement('div');
        taskElement.classList.add('task-item'); // Keep task-item class for sorting
        taskElement.innerHTML = `
            <div class="task-card bg-white p-4 ${task.is_complete ? 'completed' : 'pending'}" style="box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 5px rgba(0, 100, 80, 0.05);">
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0 pt-1">
                        <input type="checkbox" class="checkbox" style="border-color: var(--moonstone); color: white;" 
                            ${task.is_complete ? 'checked' : ''} data-id="${task.id}">
                    </div>
                    <div class="flex-grow">
                        <p class="task-text text-gray-800 ${task.is_complete ? 'task-text-complete' : ''} mb-2">
                            ${task.task_text}
                        </p>
                        <div class="task-meta">
                            <span class="flex items-center gap-1">
                                <i class="fas fa-user-edit text-xs"></i>
                                ${createdByDisplayName}
                            </span>
                            ${task.updated_at !== task.created_at ? 
                                `<span class="flex items-center gap-1 mt-1">
                                    <i class="fas fa-clock text-xs"></i>
                                    Modificado por ${lastModifiedByDisplayName}
                                </span>` : ''}
                        </div>
                    </div>
                    <div class="task-actions flex gap-1 flex-shrink-0">
                        <button class="action-btn task-edit-btn" style="color: var(--moonstone);" data-id="${task.id}" aria-label="Editar">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        <button class="action-btn task-delete-btn" style="color: var(--indigo-dye);" data-id="${task.id}" aria-label="Eliminar">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        tasksList.appendChild(taskElement);
    });
}

async function addTask() {
    const taskText = newTaskText.value.trim();
    if (!taskText) return;

    loadingIndicator.classList.remove('hidden');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.id) {
        console.error('User not signed in or user ID not available.');
        loadingIndicator.classList.add('hidden');
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
    }
    
    loadTasks(user.email); // Reload tasks
}

async function updateTaskStatus(taskId, isComplete) {
    loadingIndicator.classList.remove('hidden');
    
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
        console.error('User not signed in for status update.');
        loadingIndicator.classList.add('hidden');
        return;
    }

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
    }
    
    loadTasks(user.email); // Reload tasks
}

async function updateTaskText(taskId, newText) {
    if (!newText.trim()) return;
    
    loadingIndicator.classList.remove('hidden');
    
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
        console.error('User not signed in for text update.');
        loadingIndicator.classList.add('hidden');
        return;
    }

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
    }
    
    hideEditModal();
    loadTasks(user.email); // Reload tasks
}

async function deleteTask(taskId) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta tarea?')) return;
    
    loadingIndicator.classList.remove('hidden');
    
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

    if (error) {
        console.error('Error deleting task:', error.message);
    }
    
    loadTasks(user?.email); // Reload tasks
}

async function updateTaskOrder() {
    console.log('Updating task order in database...');
    loadingIndicator.classList.remove('hidden');
    
    const taskElements = tasksList.querySelectorAll('.task-item');
    const updates = Array.from(taskElements).map((item, index) => ({
        id: item.querySelector('.checkbox').dataset.id,
        order: index
    }));

    // Actualiza el orden de las tareas
    let error = null;
    for (const update of updates) {
        const { error: updateError } = await supabase
            .from('tasks')
            .update({ order: update.order })
            .eq('id', update.id);
        if (updateError) {
            error = updateError;
            console.error('Error updating task order for id', update.id, ':', updateError.message);
        }
    }

    loadingIndicator.classList.add('hidden');
    
    if (error) {
        console.error('Error updating task order:', error.message);
    } else {
        console.log('Task order updated successfully.');
    }
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    // Auth event listeners
    googleSigninBtn.addEventListener('click', () => {
        console.log('Google sign-in button clicked');
        signInWithGoogle();
    });
    
    signoutBtn.addEventListener('click', signOut);
    
    // Task input event listeners
    addTaskBtn.addEventListener('click', addTask);
    
    newTaskText.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTask();
        }
    });

    // Task list event listeners
    tasksList.addEventListener('change', (event) => {
        if (event.target.type === 'checkbox') {
            const taskId = event.target.dataset.id;
            const isComplete = event.target.checked;
            updateTaskStatus(taskId, isComplete);
        }
    });

    tasksList.addEventListener('click', (event) => {
        // Delete button
        if (event.target.closest('.task-delete-btn')) {
            const deleteBtn = event.target.closest('.task-delete-btn');
            const taskId = deleteBtn.dataset.id;
            deleteTask(taskId);
        }
        
        // Edit button
        if (event.target.closest('.task-edit-btn')) {
            const editBtn = event.target.closest('.task-edit-btn');
            const taskId = editBtn.dataset.id;
            const taskCard = editBtn.closest('.task-card');
            const taskText = taskCard.querySelector('.task-text').textContent.trim();
            showEditModal(taskId, taskText);
        }
    });
    
    // Modal event listeners
    cancelEditBtn.addEventListener('click', hideEditModal);
    saveEditBtn.addEventListener('click', () => {
        const taskId = editTaskId.value;
        const newText = editTaskInput.value.trim();
        updateTaskText(taskId, newText);
    });
    
    editTaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const taskId = editTaskId.value;
            const newText = editTaskInput.value.trim();
            updateTaskText(taskId, newText);
        }
    });

    // Initialize SortableJS
    const sortable = new Sortable(tasksList, {
        animation: 150,
        ghostClass: 'bg-gray-100',
        onEnd: function (evt) {
            console.log('Task dropped:', evt.item);
            updateTaskOrder();
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
