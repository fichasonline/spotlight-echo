import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserRow {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, created_at")
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("[AdminUsers] fetch error:", fetchError);
        setError("No se pudieron cargar los usuarios. Reintenta más tarde.");
        setUsers([]);
      } else {
        setUsers(data ?? []);
      }

      setLoading(false);
    };

    void loadUsers();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Usuarios</h1>
            <p className="text-sm text-muted-foreground">Lista de usuarios registrados y su información básica.</p>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:border-primary/30"
          >
            Volver al dashboard
          </Link>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Cargando usuarios...</div>
          ) : error ? (
            <div className="py-16 text-center text-sm text-destructive">{error}</div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No hay usuarios registrados.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-full table-fixed text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead>ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="truncate">
                        <div className="flex items-center gap-3">
                              <Avatar>
                            {user.avatar_url ? (
                              <AvatarImage
                                src={user.avatar_url}
                                alt={user.display_name ?? "Avatar"}
                                onError={(event) => {
                                  event.currentTarget.src = "";
                                }}
                              />
                            ) : null}
                            <AvatarFallback>
                              {user.display_name?.charAt(0).toUpperCase() ?? "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="leading-tight">
                            <p className="font-medium text-foreground">{user.display_name ?? "Sin nombre"}</p>
                            <p className="text-xs text-muted-foreground">{user.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="truncate text-muted-foreground">{user.username ?? "-"}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(user.created_at).toLocaleString("es-UY", {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="truncate text-muted-foreground">{user.id}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
