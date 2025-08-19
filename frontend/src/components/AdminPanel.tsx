import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AdminPanel.css';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
  role_permissions?: string[];
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  is_system: boolean;
  created_at: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  is_system: boolean;
}

interface SystemStats {
  total_users: number;
  active_users: number;
  admin_users: number;
  avg_daily_quota: number;
  avg_monthly_quota: number;
  roles: Array<{ role: string; count: number }>;
  permissions: Array<{ category: string; count: number }>;
}

const AdminPanel: React.FC = () => {
  const { user, tokens } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'roles' | 'permissions'>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
    is_active: true
  });
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    permissions: [] as string[]
  });

  // Backend API base URL
  const API_BASE = 'http://localhost:3001/api/admin';

  useEffect(() => {
    if (user?.role === 'admin') {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [statsRes, usersRes, rolesRes, permissionsRes] = await Promise.all([
        fetch(`${API_BASE}/stats`, {
          headers: { 'Authorization': `Bearer ${tokens?.accessToken}` }
        }),
        fetch(`${API_BASE}/users`, {
          headers: { 'Authorization': `Bearer ${tokens?.accessToken}` }
        }),
        fetch(`${API_BASE}/roles`, {
          headers: { 'Authorization': `Bearer ${tokens?.accessToken}` }
        }),
        fetch(`${API_BASE}/permissions`, {
          headers: { 'Authorization': `Bearer ${tokens?.accessToken}` }
        })
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setSystemStats(statsData.data);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.data.users || []);
      }

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData.data || []);
      }

      if (permissionsRes.ok) {
        const permissionsData = await permissionsRes.json();
        setPermissions(permissionsData.data || []);
      }
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const url = selectedUser ? `${API_BASE}/users/${selectedUser.id}` : `${API_BASE}/users`;
      const method = selectedUser ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens?.accessToken}`
        },
        body: JSON.stringify(userForm)
      });

      if (response.ok) {
        setShowUserModal(false);
        setSelectedUser(null);
        setUserForm({ username: '', email: '', password: '', role: 'user', is_active: true });
        loadDashboardData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save user');
      }
    } catch (err) {
      setError('Failed to save user');
      console.error('Error saving user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const url = selectedRole ? `${API_BASE}/roles/${selectedRole.id}` : `${API_BASE}/roles`;
      const method = selectedRole ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens?.accessToken}`
        },
        body: JSON.stringify(roleForm)
      });

      if (response.ok) {
        setShowRoleModal(false);
        setSelectedRole(null);
        setRoleForm({ name: '', description: '', permissions: [] });
        loadDashboardData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save role');
      }
    } catch (err) {
      setError('Failed to save role');
      console.error('Error saving role:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokens?.accessToken}` }
      });

      if (response.ok) {
        loadDashboardData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete user');
      }
    } catch (err) {
      setError('Failed to delete user');
      console.error('Error deleting user:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/roles/${roleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokens?.accessToken}` }
      });

      if (response.ok) {
        loadDashboardData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete role');
      }
    } catch (err) {
      setError('Failed to delete role');
      console.error('Error deleting role:', err);
    } finally {
      setLoading(false);
    }
  };

  const editUser = (user: User) => {
    setSelectedUser(user);
    setUserForm({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      is_active: user.is_active
    });
    setShowUserModal(true);
  };

  const editRole = (role: Role) => {
    setSelectedRole(role);
    setRoleForm({
      name: role.name,
      description: role.description,
      permissions: role.permissions
    });
    setShowRoleModal(true);
  };

  const addNewUser = () => {
    setSelectedUser(null);
    setUserForm({ username: '', email: '', password: '', role: 'user', is_active: true });
    setShowUserModal(true);
  };

  const addNewRole = () => {
    setSelectedRole(null);
    setRoleForm({ name: '', description: '', permissions: [] });
    setShowRoleModal(true);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="admin-panel">
        <div className="access-denied">
          <h2>🔒 Access Denied</h2>
          <p>You don't have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>🔧 Admin Panel</h1>
        <p>System administration and user management</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="admin-tabs">
        <button
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          👥 Users
        </button>
        <button
          className={activeTab === 'roles' ? 'active' : ''}
          onClick={() => setActiveTab('roles')}
        >
          🏷️ Roles
        </button>
        <button
          className={activeTab === 'permissions' ? 'active' : ''}
          onClick={() => setActiveTab('permissions')}
        >
          🔑 Permissions
        </button>
      </div>

      <div className="admin-content">
        {loading && <div className="loading">Loading...</div>}

        {activeTab === 'dashboard' && systemStats && (
          <div className="dashboard-grid">
            <div className="stat-card">
              <h3>Total Users</h3>
              <div className="stat-value">{systemStats.total_users}</div>
            </div>
            <div className="stat-card">
              <h3>Active Users</h3>
              <div className="stat-value">{systemStats.active_users}</div>
            </div>
            <div className="stat-card">
              <h3>Admin Users</h3>
              <div className="stat-value">{systemStats.admin_users}</div>
            </div>
            <div className="stat-card">
              <h3>Roles</h3>
              <div className="stat-value">{systemStats.roles.length}</div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-section">
            <div className="section-header">
              <h2>User Management</h2>
              <button onClick={addNewUser} className="add-button">
                ➕ Add User
              </button>
            </div>
            
            <div className="users-table">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`role-badge role-${user.role}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{new Date(user.created_at).toLocaleDateString()}</td>
                      <td>
                        {user.last_login 
                          ? new Date(user.last_login).toLocaleDateString()
                          : 'Never'
                        }
                      </td>
                      <td>
                        <button onClick={() => editUser(user)} className="edit-button">
                          ✏️ Edit
                        </button>
                        <button 
                          onClick={() => deleteUser(user.id)} 
                          className="delete-button"
                          disabled={user.role === 'admin'}
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="roles-section">
            <div className="section-header">
              <h2>Role Management</h2>
              <button onClick={addNewRole} className="add-button">
                ➕ Add Role
              </button>
            </div>
            
            <div className="roles-grid">
              {roles.map(role => (
                <div key={role.id} className="role-card">
                  <div className="role-header">
                    <h3>{role.name}</h3>
                    {role.is_system && <span className="system-badge">System</span>}
                  </div>
                  <p>{role.description}</p>
                  <div className="permissions-list">
                    <strong>Permissions:</strong>
                    <div className="permission-tags">
                      {role.permissions.map(perm => (
                        <span key={perm} className="permission-tag">
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="role-actions">
                    <button 
                      onClick={() => editRole(role)} 
                      className="edit-button"
                      disabled={role.is_system}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      onClick={() => deleteRole(role.id)} 
                      className="delete-button"
                      disabled={role.is_system}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'permissions' && (
          <div className="permissions-section">
            <h2>System Permissions</h2>
            <div className="permissions-grid">
              {permissions.map(permission => (
                <div key={permission.id} className="permission-card">
                  <div className="permission-header">
                    <h3>{permission.name}</h3>
                    {permission.is_system && <span className="system-badge">System</span>}
                  </div>
                  <p>{permission.description}</p>
                  <span className="category-badge">{permission.category}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{selectedUser ? 'Edit User' : 'Add New User'}</h2>
              <button onClick={() => setShowUserModal(false)}>✕</button>
            </div>
            <form onSubmit={handleUserSubmit}>
              <div className="form-group">
                <label>Username:</label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password:</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                  required={!selectedUser}
                  placeholder={selectedUser ? 'Leave blank to keep current' : ''}
                />
              </div>
              <div className="form-group">
                <label>Role:</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                >
                  {roles.map(role => (
                    <option key={role.name} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={userForm.is_active}
                    onChange={(e) => setUserForm({...userForm, is_active: e.target.checked})}
                  />
                  Active
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : (selectedUser ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Modal */}
      {showRoleModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{selectedRole ? 'Edit Role' : 'Add New Role'}</h2>
              <button onClick={() => setShowRoleModal(false)}>✕</button>
            </div>
            <form onSubmit={handleRoleSubmit}>
              <div className="form-group">
                <label>Name:</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({...roleForm, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description:</label>
                <textarea
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({...roleForm, description: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Permissions:</label>
                <div className="permissions-selector">
                  {permissions.map(permission => (
                    <label key={permission.id} className="permission-checkbox">
                      <input
                        type="checkbox"
                        checked={roleForm.permissions.includes(permission.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRoleForm({
                              ...roleForm,
                              permissions: [...roleForm.permissions, permission.name]
                            });
                          } else {
                            setRoleForm({
                              ...roleForm,
                              permissions: roleForm.permissions.filter(p => p !== permission.name)
                            });
                          }
                        }}
                      />
                      <span className="permission-name">{permission.name}</span>
                      <span className="permission-category">({permission.category})</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowRoleModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : (selectedRole ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
