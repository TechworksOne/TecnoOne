import { Edit, Key, Plus, ToggleLeft, ToggleRight, User } from "lucide-react";
import { useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import Table from "../../components/ui/Table";
import { useToast } from "../../components/ui/Toast";
import { mockUsers } from "../../lib/mock";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "admin" | "employee";
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

export default function UsersPage() {
  const toast = useToast();

  const [users, setUsers] = useState<User[]>([
    ...mockUsers.map((u) => ({
      ...u,
      role: u.role as "admin" | "employee",
      phone: "+502 5555-" + Math.floor(Math.random() * 9000 + 1000),
      createdAt: "2024-01-15",
      lastLogin: Math.random() > 0.3 ? "2024-10-" + Math.floor(Math.random() * 20 + 1) : undefined,
    })),
  ]);

  const [showUserModal, setShowUserModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showToggleDialog, setShowToggleDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "employee" as "admin" | "employee",
    password: "",
    confirmPassword: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const usersTableData = users.map((user) => ({
    ID: user.id,
    Nombre: user.name,
    Email: user.email,
    Teléfono: user.phone || "-",
    Rol: user.role === "admin" ? "Administrador" : "Empleado",
    Estado: (
      <Badge color={user.active ? "green" : "red"}>{user.active ? "Activo" : "Inactivo"}</Badge>
    ),
    "Último Acceso": user.lastLogin
      ? new Date(user.lastLogin).toLocaleDateString("es-GT")
      : "Nunca",
    Acciones: (
      <div className="flex gap-1">
        <Button variant="ghost" onClick={() => editUser(user)} title="Editar">
          <Edit size={16} />
        </Button>
        <Button variant="ghost" onClick={() => changePassword(user)} title="Cambiar Contraseña">
          <Key size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => toggleUserStatus(user)}
          title={user.active ? "Desactivar" : "Activar"}
          className={user.active ? "text-red-600" : "text-green-600"}
        >
          {user.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
        </Button>
      </div>
    ),
  }));

  function editUser(user?: User) {
    if (user) {
      setEditingUser(user);
      setUserForm({
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        password: "",
        confirmPassword: "",
      });
    } else {
      setEditingUser(null);
      setUserForm({
        name: "",
        email: "",
        phone: "",
        role: "employee",
        password: "",
        confirmPassword: "",
      });
    }
    setShowUserModal(true);
  }

  function changePassword(user: User) {
    setSelectedUser(user);
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setShowPasswordModal(true);
  }

  function toggleUserStatus(user: User) {
    setSelectedUser(user);
    setShowToggleDialog(true);
  }

  function saveUser() {
    // Validaciones básicas
    if (!userForm.name || !userForm.email) {
      toast.add("Nombre y email son requeridos");
      return;
    }

    if (!editingUser && (!userForm.password || userForm.password !== userForm.confirmPassword)) {
      toast.add("Las contraseñas no coinciden");
      return;
    }

    if (editingUser) {
      // Actualizar usuario existente
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                name: userForm.name,
                email: userForm.email,
                phone: userForm.phone,
                role: userForm.role,
              }
            : u
        )
      );
      toast.add("Usuario actualizado exitosamente");
    } else {
      // Crear nuevo usuario
      const newUser: User = {
        id: `emp${users.length + 1}`,
        name: userForm.name,
        email: userForm.email,
        phone: userForm.phone,
        role: userForm.role,
        active: true,
        createdAt: new Date().toISOString().split("T")[0],
      };
      setUsers((prev) => [...prev, newUser]);
      toast.add("Usuario creado exitosamente");
    }

    setShowUserModal(false);
    setEditingUser(null);
  }

  function updatePassword() {
    if (!passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.add("Las contraseñas no coinciden");
      return;
    }

    toast.add(`Contraseña actualizada para ${selectedUser?.name}`);
    setShowPasswordModal(false);
    setSelectedUser(null);
  }

  function confirmToggleStatus() {
    if (!selectedUser) return;

    setUsers((prev) =>
      prev.map((u) => (u.id === selectedUser.id ? { ...u, active: !u.active } : u))
    );

    toast.add(`Usuario ${selectedUser.active ? "desactivado" : "activado"}`);
    setShowToggleDialog(false);
    setSelectedUser(null);
  }

  const activeUsers = users.filter((u) => u.active).length;
  const adminUsers = users.filter((u) => u.role === "admin").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 space-y-6 sm:space-y-8">
      <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-sm border-0 shadow-lg rounded-2xl p-6">
        <PageHeader title="Usuarios" subtitle="Gestión de empleados y administradores" />
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <User size={28} className="text-white/80" />
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">{users.length}</div>
            <div className="text-blue-100">Total Usuarios</div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <ToggleRight size={28} className="text-white/80" />
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">{activeUsers}</div>
            <div className="text-emerald-100">Usuarios Activos</div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-violet-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Key size={28} className="text-white/80" />
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🔑</span>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">{adminUsers}</div>
            <div className="text-purple-100">Administradores</div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-amber-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <User size={28} className="text-white/80" />
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">💼</span>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">{users.length - adminUsers}</div>
            <div className="text-orange-100">Empleados</div>
          </div>
        </Card>
      </div>

      <Card className="mb-6 bg-white/90 dark:bg-slate-900/95 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold tracking-tight">Gestión de Usuarios</h3>
              <p className="text-indigo-100 mt-1">Control de acceso y permisos del sistema</p>
            </div>
            <Button
              onClick={() => {
                setEditingUser(null);
                setUserForm({
                  name: "",
                  email: "",
                  phone: "",
                  role: "employee" as "admin" | "employee",
                  password: "",
                  confirmPassword: "",
                });
                setShowUserModal(true);
              }}
              className="w-full lg:w-auto bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 border-0 shadow-lg font-semibold transition-all duration-200 hover:scale-105"
            >
              <Plus size={16} className="mr-2" />
              Nuevo Usuario
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden bg-white/95 dark:bg-slate-900/98 backdrop-blur-sm border-0 shadow-2xl rounded-2xl">
        <div className="overflow-x-auto">
          <Table columns={Object.keys(usersTableData[0] || {})} data={usersTableData} />
        </div>
      </Card>

      {/* Modal crear/editar usuario */}
      <Modal
        open={showUserModal}
        onClose={() => setShowUserModal(false)}
        title={editingUser ? "Editar Usuario" : "Nuevo Usuario"}
      >
        <div className="space-y-6">
          {/* Información personal */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-200">
            <h4 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center">
              <div className="w-2 h-2 bg-indigo-500 rounded-full mr-3"></div>
              Información Personal
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">
                  Nombre Completo
                </label>
                <Input
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="Juan Pérez"
                  className="border-2 border-indigo-200 focus:border-indigo-500 rounded-xl shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Email</label>
                <Input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="juan@ferreteria.com"
                  className="border-2 border-indigo-200 focus:border-indigo-500 rounded-xl shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Teléfono</label>
                <Input
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  placeholder="+502 5555-1234"
                  className="border-2 border-indigo-200 focus:border-indigo-500 rounded-xl shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Rol</label>
                <Select
                  value={userForm.role}
                  onChange={(e) =>
                    setUserForm({ ...userForm, role: e.target.value as "admin" | "employee" })
                  }
                  className="border-2 border-indigo-200 focus:border-indigo-500 rounded-xl shadow-sm"
                >
                  <option value="employee">👤 Empleado</option>
                  <option value="admin">🔑 Administrador</option>
                </Select>
              </div>
            </div>
          </div>

          {!editingUser && (
            <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-6 rounded-xl border border-purple-200">
              <h4 className="text-lg font-semibold text-purple-900 mb-4 flex items-center">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                Configuración de Acceso
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    Contraseña
                  </label>
                  <Input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="border-2 border-purple-200 focus:border-purple-500 rounded-xl shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    Confirmar Contraseña
                  </label>
                  <Input
                    type="password"
                    value={userForm.confirmPassword}
                    onChange={(e) => setUserForm({ ...userForm, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    className="border-2 border-purple-200 focus:border-purple-500 rounded-xl shadow-sm"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-slate-200">
            <Button
              variant="ghost"
              onClick={() => setShowUserModal(false)}
              className="w-full sm:w-auto px-6 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-all duration-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={saveUser}
              className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white rounded-xl font-semibold shadow-lg transition-all duration-200 hover:scale-105"
            >
              {editingUser ? "💾 Actualizar" : "✨ Crear"} Usuario
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal cambiar contraseña */}
            {/* Modal cambiar contraseña */}
      <Modal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Cambiar Contraseña"
      >
        <div className="space-y-6">
          {/* Información del usuario */}
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-6 rounded-xl border border-amber-200">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full flex items-center justify-center">
                <span className="text-white text-xl">🔑</span>
              </div>
              <div>
                <div className="font-semibold text-amber-900">Usuario: {selectedUser?.name}</div>
                <div className="text-sm text-amber-700">{selectedUser?.email}</div>
              </div>
            </div>
          </div>

          {/* Formulario de contraseñas */}
          <div className="bg-gradient-to-r from-red-50 to-pink-50 p-6 rounded-xl border border-red-200">
            <h4 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
              Actualización de Credenciales
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Contraseña Actual</label>
                <Input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                  }
                  placeholder="••••••••"
                  className="border-2 border-red-200 focus:border-red-500 rounded-xl shadow-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Nueva Contraseña</label>
                <Input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="••••••••"
                  className="border-2 border-red-200 focus:border-red-500 rounded-xl shadow-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Confirmar Nueva Contraseña</label>
                <Input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  placeholder="••••••••"
                  className="border-2 border-red-200 focus:border-red-500 rounded-xl shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-slate-200">
            <Button
              variant="ghost"
              onClick={() => setShowPasswordModal(false)}
              className="w-full sm:w-auto px-6 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-all duration-200"
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                if (selectedUser) {
                  changePassword(selectedUser);
                }
              }} 
              className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-xl font-semibold shadow-lg transition-all duration-200 hover:scale-105"
            >
              🔐 Cambiar Contraseña
            </Button>
          </div>
        </div>
      </Modal>

      {/* Dialog toggle estado */}
      <ConfirmDialog
        open={showToggleDialog}
        onClose={() => setShowToggleDialog(false)}
        onConfirm={confirmToggleStatus}
        title="Cambiar Estado de Usuario"
      >
        {selectedUser && (
          <div>
            <p className="mb-4">
              ¿Está seguro que desea {selectedUser.active ? "desactivar" : "activar"} al usuario{" "}
              <strong>{selectedUser.name}</strong>?
            </p>
            <div className="bg-yellow-50 p-3 rounded">
              <div className="text-sm">
                {selectedUser.active
                  ? "El usuario no podrá acceder al sistema hasta que sea reactivado."
                  : "El usuario podrá acceder al sistema nuevamente."}
              </div>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
