import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://uvckphoyynzibfldjhft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2Y2twaG95eW56aWJmbGRqaGZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc2NDQ2OTIsImV4cCI6MjA2MzIyMDY5Mn0.b5prJX7zulVdkB3nmdF6Cl54tc_I62r764SoGZZ73-g';
const supabase = createClient(supabaseUrl, supabaseKey);

// Logs de depuración
console.log('Inicializando aplicación de listas de tareas...');

const authDiv = document.getElementById('auth');
const appDiv = document.getElementById('app');
const accessDeniedMsg = document.getElementById('access-denied');
const newTaskText = document.getElementById('new-task-text');
const addTaskBtn = document.getElementById('add-task-btn');
const tasksList = document.getElementById('tasks-list');
const avatarDropdownBtn = document.getElementById('avatar-dropdown-btn');
const authDebugLog = document.getElementById('auth-debug-log');

function logDebug(message) {
    console.log(message);
    if (authDebugLog) {
        const logEntry = document.createElement('div');
        logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
        authDebugLog.appendChild(logEntry);
        document.getElementById('auth-debug').classList.remove('hidden');
    }
}

// Define a map for user IDs/emails to display names (customize these)
const userDisplayNameMap = {
    'juanfranbrv@gmail.com': 'Juanfran',
    'vicentbriva@gmail.com': 'Vicent',
    'emiglesi@gmail.com': 'Emi'
    // Add more mappings as needed
};

// --- Authentication ---

async function signInWithGoogle() {
    logDebug('Iniciando proceso de inicio de sesión con Google...');
    const redirectUrl = window.location.origin;
    logDebug('URL de redirección: ' + redirectUrl);
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl
            }
        });
        if (error) {
            logDebug('Error al iniciar sesión con Google: ' + error.message);
        } else {
            logDebug('Solicitud de inicio de sesión enviada correctamente.');
        }
    } catch (e) {
        logDebug('Excepción al iniciar sesión: ' + e.message);
    }
}

async function signOut() {
    logDebug('Cerrando sesión...');
    const { error } = await supabase.auth.signOut();
    if (error) {
        logDebug('Error al cerrar sesión: ' + error.message);
    } else {
        logDebug('Sesión cerrada correctamente.');
    }
}

supabase.auth.onAuthStateChange((event, session) => {
    logDebug('Cambio en el estado de autenticación: ' + event);
    if (event === 'SIGNED_IN' && session) {
        logDebug('Usuario autenticado, ID: ' + session.user.id);
        handleSignedInUser(session.user);
    } else if (event === 'SIGNED_OUT') {
        logDebug('Usuario desconectado');
        handleSignedOutUser();
    } else {
        logDebug('Otro evento de autenticación: ' + event);
    }
});

async function handleSignedInUser(user) {
    // Check if user email is in whitelist (RLS will handle actual data access)
    // For UI purposes, we can try fetching data and show access denied if it fails
    logDebug('Usuario conectado: ' + user.email);
    
    // Mostrar la interfaz de usuario
    authDiv.classList.add('hidden');
    appDiv.classList.remove('hidden');
    accessDeniedMsg.classList.add('hidden'); // Hide access denied initially

    // Display avatar
    if (avatarDropdownBtn) {
        logDebug('Configurando avatar...');
        avatarDropdownBtn.closest('.dropdown').classList.remove('hidden'); // Show the dropdown container
        const avatarImgContainer = avatarDropdownBtn.querySelector('.rounded-full');
        if (avatarImgContainer && user.user_metadata && user.user_metadata.avatar_url) {
            avatarImgContainer.innerHTML = `<img src="${user.user_metadata.avatar_url}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else if (avatarImgContainer) {
             avatarImgContainer.innerHTML = ''; // Clear any previous content
        }
    }

    // Attempt to load tasks - RLS will determine if allowed
    loadTasks(user.email);
}

function handleSignedOutUser() {
    logDebug('Manejando usuario desconectado.');
    authDiv.classList.remove('hidden');
    appDiv.classList.add('hidden');
    tasksList.innerHTML = ''; // Clear tasks list
    accessDeniedMsg.classList.add('hidden'); // Hide access denied
    if (avatarDropdownBtn) {
        avatarDropdownBtn.closest('.dropdown').classList.add('hidden'); // Hide the dropdown container
        const avatarImgContainer = avatarDropdownBtn.querySelector('.rounded-full');
        if (avatarImgContainer) {
            avatarImgContainer.innerHTML = ''; // Clear avatar content
        }
    }
}

// --- Task Management (CRUD) ---

async function loadTasks(currentUserEmail) {
    logDebug('Cargando tareas para el usuario: ' + currentUserEmail);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        logDebug('No hay usuario activo, no se pueden cargar tareas.');
        return;
    }

    const { data, error } = await supabase
        .from('tasks')
        .select('*, owner_user_id, created_by_user_id, last_modified_by_user_id') // Select all columns including user IDs
        .order('order', { ascending: true }) // Order by the new 'order' column
        .order('created_at', { ascending: true }); // Secondary sort by created_at

    if (error) {
        logDebug('Error al cargar tareas: ' + error.message);
        if (error.message.includes('permission denied')) { // Basic check for RLS denial
             accessDeniedMsg.classList.remove('hidden');
             tasksList.innerHTML = ''; // Clear tasks if access denied
        }
    } else {
        logDebug('Tareas cargadas correctamente: ' + data.length + ' tareas encontradas');
        
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
            logDebug('Estableciendo orden inicial para las tareas...');
            const updates = data.map((task, index) => ({
                id: task.id,
                order: index
            }));
            const { error: updateError } = await supabase
                .from('tasks')
                .upsert(updates);

            if (updateError) {
                logDebug('Error al establecer orden inicial: ' + updateError.message);
            } else {
                logDebug('Orden inicial establecido, recargando tareas...');
                // Reload tasks after setting initial order
                loadTasks(currentUserEmail);
                return;
            }
        }

        // Fetch user emails for the extracted IDs
        const { data: usersData, error: usersError } = await supabase
            .from('users') // Reference public.users table
            .select('id, email')
            .in('id', Array.from(userIds));

        if (usersError) {
            logDebug('Error al obtener usuarios: ' + usersError.message);
            displayTasks(data, {}); // Display tasks with IDs if user fetch fails
        } else {
            logDebug('Datos de usuarios cargados correctamente');
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
    logDebug('Mostrando ' + tasks.length + ' tareas en pantalla');
    tasksList.innerHTML = ''; // Clear current list
    tasks.forEach(task => {
        const createdByUserEmail = userEmailMap[task.created_by_user_id] || 'Desconocido';
        const lastModifiedByUserEmail = userEmailMap[task.last_modified_by_user_id] || 'Desconocido';

        const createdByDisplayName = userDisplayNameMap[createdByUserEmail] || createdByUserEmail;
        const lastModifiedByDisplayName = userDisplayNameMap[lastModifiedByUserEmail] || lastModifiedByUserEmail;


        const taskElement = document.createElement('div');
        taskElement.classList.add('task-item'); // Keep task-item class for sorting
        if (task.is_complete) {
            taskElement.classList.add('task-complete');
        }
        taskElement.innerHTML = `
            <div class="card bg-base-100 shadow-lg p-4 task-card-body">
                <div class="task-flex-container flex justify-between items-center min-h-16">
                    <div class="flex items-center">
                        <input type="checkbox" class="checkbox checkbox-primary task-checkbox mr-2" ${task.is_complete ? 'checked' : ''} data-id="${task.id}">
                        <span class="task-text ${task.is_complete ? 'task-text-complete' : ''}">${task.task_text}</span>
                    </div>
                    <div class="task-buttons flex gap-2">
                        <button class="task-btn task-edit-btn btn btn-sm" data-id="${task.id}">Editar</button>
                        <button class="task-btn task-delete-btn btn btn-sm" data-id="${task.id}">Eliminar</button>
                    </div>
                </div>
                <div class="task-meta text-gray-500 text-sm mt-2">
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
        logDebug('Usuario no conectado o ID de usuario no disponible.');
        return;
    }

    logDebug('Añadiendo nueva tarea: ' + taskText);
    
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
        logDebug('Error al añadir tarea: ' + error.message);
    } else {
        logDebug('Tarea añadida correctamente.');
        newTaskText.value = ''; // Clear input
        loadTasks(); // Reload tasks
    }
}

async function updateTaskStatus(taskId, isComplete) {
    logDebug('Actualizando estado de tarea ' + taskId + ' a ' + (isComplete ? 'completada' : 'pendiente'));
    
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
        logDebug('Usuario no conectado para actualización de estado.');
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
        logDebug('Error al actualizar estado de tarea: ' + error.message);
    } else {
        logDebug('Estado de tarea actualizado correctamente.');
        loadTasks(); // Reload tasks
    }
}

async function updateTaskText(taskId, newText) {
    logDebug('Actualizando texto de tarea ' + taskId + ' a: ' + newText);
    
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
        logDebug('Usuario no conectado para actualización de texto.');
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
        logDebug('Error al actualizar texto de tarea: ' + error.message);
    } else {
        logDebug('Texto de tarea actualizado correctamente.');
        loadTasks(); // Reload tasks
    }
}

async function deleteTask(taskId) {
    logDebug('Eliminando tarea ' + taskId);
    
    const { data, error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

    if (error) {
        logDebug('Error al eliminar tarea: ' + error.message);
    } else {
        logDebug('Tarea eliminada correctamente.');
        loadTasks(); // Reload tasks
    }
}


// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    logDebug('DOM cargado completamente.');
    logDebug('Auth div visible: ' + !authDiv.classList.contains('hidden'));
    logDebug('App div oculto: ' + appDiv.classList.contains('hidden'));
    
    // Configurar el botón manual de inicio de sesión
    const manualSigninBtn = document.getElementById('manual-signin-btn');
    if (manualSigninBtn) {
        manualSigninBtn.addEventListener('click', () => {
            logDebug('Botón manual de inicio de sesión pulsado.');
            signInWithGoogle();
        });
    } else {
        logDebug('ADVERTENCIA: Botón manual de inicio de sesión no encontrado.');
    }
    
    // Configurar el botón de cerrar sesión
    const signoutBtnMenu = document.getElementById('signout-btn-menu');
    if (signoutBtnMenu) {
        signoutBtnMenu.addEventListener('click', signOut);
    } else {
        logDebug('ADVERTENCIA: Botón de cerrar sesión no encontrado.');
    }
    
    // Botón para añadir tareas
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', addTask);
    } else {
        logDebug('ADVERTENCIA: Botón para añadir tareas no encontrado.');
    }

    // Gestionar cambios en las tareas (checkbox)
    tasksList.addEventListener('change', (event) => {
        if (event.target.type === 'checkbox' && event.target.classList.contains('task-checkbox')) {
            const taskId = event.target.dataset.id;
            const isComplete = event.target.checked;
            updateTaskStatus(taskId, isComplete);
        }
    });

    // Gestionar clics en las tareas (editar/eliminar)
    tasksList.addEventListener('click', (event) => {
        if (event.target.classList.contains('task-delete-btn')) {
            const taskId = event.target.dataset.id;
            deleteTask(taskId);
        }
        if (event.target.classList.contains('task-edit-btn')) {
            const taskId = event.target.dataset.id;
            const currentTaskElement = event.target.closest('.task-card-body').querySelector('.task-text');
            const currentText = currentTaskElement.textContent;

            const editModal = document.getElementById('edit_task_modal');
            const editTaskInput = document.getElementById('edit-task-text');

            if (editModal && editTaskInput) {
                editTaskInput.value = currentText;
                editModal.dataset.editingTaskId = taskId; // Store the task ID in the modal's dataset
                editModal.showModal();
            } else {
                logDebug('Error: Modal de edición o input no encontrado.');
            }
        }
    });

    // Listener for the Save Changes button in the modal
    const saveTaskBtn = document.getElementById('save-task-btn');
    if (saveTaskBtn) {
        saveTaskBtn.addEventListener('click', async () => {
            const editModal = document.getElementById('edit_task_modal');
            const editTaskInput = document.getElementById('edit-task-text');
            const taskId = editModal.dataset.editingTaskId;
            const newText = editTaskInput.value.trim();

            if (taskId && newText !== '') {
                await updateTaskText(taskId, newText);
                editModal.close(); // Close the modal after saving
            } else {
                logDebug('Advertencia: ID de tarea o nuevo texto faltante.');
            }
        });
    } else {
        logDebug('ADVERTENCIA: Botón para guardar tarea no encontrado.');
    }

    // Initialize SortableJS
    const sortable = new Sortable(tasksList, {
        animation: 150,
        onEnd: function (evt) {
            logDebug('Tarea reordenada');
            updateTaskOrder();
        }
    });

    // Initial check on page load
    logDebug('Verificando sesión inicial...');
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            logDebug('Sesión existente encontrada.');
            handleSignedInUser(session.user);
        } else {
            logDebug('No se encontró sesión existente.');
            handleSignedOutUser();
        }
    }).catch(error => {
        logDebug('Error al verificar sesión: ' + error.message);
    });
});

async function updateTaskOrder() {
    logDebug('Actualizando orden de tareas en la base de datos...');
    const taskElements = tasksList.querySelectorAll('.task-item');
    const updates = Array.from(taskElements).map((item, index) => ({
        id: item.querySelector('.task-checkbox').dataset.id,
        order: index
    }));

    // Actualiza el orden de las tareas usando update en vez de upsert
    let error = null;
    for (const update of updates) {
        const { error: updateError } = await supabase
            .from('tasks')
            .update({ order: update.order })
            .eq('id', update.id);
        if (updateError) {
            error = updateError;
            logDebug('Error al actualizar orden de tarea para id ' + update.id + ': ' + updateError.message);
        }
    }

    if (error) {
        logDebug('Error al actualizar orden de tareas: ' + error.message);
    } else {
        logDebug('Orden de tareas actualizado correctamente.');
        // No need to reload tasks here, as the UI is already updated by SortableJS
    }
}

// Function to handle the Google credential response
window.handleCredentialResponse = async (response) => {
    logDebug("Respuesta de autenticación de Google recibida.");
    try {
        const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
        });
        if (error) {
            logDebug('Error al iniciar sesión con token de ID de Google: ' + error.message);
        } else {
            logDebug('Inicio de sesión con token de ID de Google exitoso.');
            // handleSignedInUser will be called by the auth state change listener
        }
    } catch (e) {
        logDebug('Excepción al procesar credencial de Google: ' + e.message);
    }
}