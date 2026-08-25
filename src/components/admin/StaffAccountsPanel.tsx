import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Plus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChipGroup } from "@/components/site/ChipGroup";
import { errorMessage } from "@/lib/data";
import {
  createStaffAccount,
  deleteStaffAccount,
  listStaffAccounts,
  resetStaffPassword,
  setStaffRole,
  type StaffAccount,
  type StaffRole,
} from "@/lib/staff-auth-server.ts";

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: "staff", label: "Staff" },
  { value: "manager", label: "Manager" },
];

export function StaffAccountsPanel({
  accessToken,
  currentUserId,
}: {
  accessToken: string;
  currentUserId: string;
}) {
  const [accounts, setAccounts] = useState<StaffAccount[] | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const list = await listStaffAccounts({ data: { accessToken } });
      setAccounts(list);
    } catch (err) {
      toast.error(errorMessage(err, "Could not load staff accounts"), { duration: Infinity });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm max-w-md">
          Only managers can see this page. Staff without an email sign in with their name instead -
          give them their password directly since they can't reset it by email themselves.
        </p>
        <AddStaffDialog accessToken={accessToken} onCreated={refresh} />
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      ) : !accounts || accounts.length === 0 ? (
        <p className="text-muted-foreground text-sm">No staff accounts yet.</p>
      ) : (
        <div className="grid gap-3">
          {accounts.map((a) => (
            <StaffRow
              key={a.id}
              account={a}
              accessToken={accessToken}
              isSelf={a.id === currentUserId}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StaffRow({
  account,
  accessToken,
  isSelf,
  onChanged,
}: {
  account: StaffAccount;
  accessToken: string;
  isSelf: boolean;
  onChanged: () => void;
}) {
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleRoleChange(role: StaffRole) {
    setBusy(true);
    try {
      await setStaffRole({ data: { accessToken, targetUserId: account.id, role } });
      toast.success(`${account.displayName} is now ${role === "manager" ? "a manager" : "staff"}`);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, "Could not change role"), { duration: Infinity });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteStaffAccount({ data: { accessToken, targetUserId: account.id } });
      toast.success(`${account.displayName}'s account was deleted`);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete account"), { duration: Infinity });
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 pt-6">
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
          <UserRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-semibold">
            {account.displayName}
            {isSelf && (
              <span className="text-muted-foreground text-xs font-normal">(you)</span>
            )}
            {account.role === "manager" && (
              <Badge variant="secondary" className="gap-1 text-[0.65rem]">
                <ShieldCheck className="size-3" /> Manager
              </Badge>
            )}
          </p>
          <p className="text-muted-foreground text-xs">
            {account.hasRealEmail ? account.email : "No email on file, signs in with their name"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ChipGroup
            size="sm"
            ariaLabel={`Role for ${account.displayName}`}
            value={account.role}
            options={ROLE_OPTIONS}
            onChange={handleRoleChange}
          />
          <Dialog open={resetOpen} onOpenChange={setResetOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy}>
                <KeyRound className="size-4" /> Reset password
              </Button>
            </DialogTrigger>
            <ResetPasswordDialogContent
              accessToken={accessToken}
              account={account}
              onDone={() => setResetOpen(false)}
            />
          </Dialog>
          {!isSelf && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={busy}>
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {account.displayName}'s account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    They'll immediately lose access to the admin area. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ResetPasswordDialogContent({
  accessToken,
  account,
  onDone,
}: {
  accessToken: string;
  account: StaffAccount;
  onDone: () => void;
}) {
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      await resetStaffPassword({ data: { accessToken, targetUserId: account.id, newPassword: pw } });
      toast.success(`New password set for ${account.displayName}`);
      setPw("");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "Could not reset password"), { duration: Infinity });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Reset {account.displayName}'s password</DialogTitle>
        <DialogDescription>
          {account.hasRealEmail
            ? "They can also reset this themselves from the sign-in page, this overrides it directly."
            : "They have no email on file, so this is the only way to set their password. Tell them the new password yourself."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-2">
          <Label>New password</Label>
          <Input
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="At least 8 characters"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Set password"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function AddStaffDialog({ accessToken, onCreated }: { accessToken: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [hasEmail, setHasEmail] = useState(true);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setHasEmail(true);
    setEmail("");
    setPw("");
    setRole("staff");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Enter a name");
      return;
    }
    if (hasEmail && !email.trim()) {
      toast.error("Enter an email, or switch to \u201cNo email\u201d");
      return;
    }
    if (pw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      await createStaffAccount({
        data: {
          accessToken,
          displayName: name.trim(),
          email: hasEmail ? email.trim() : "",
          password: pw,
          role,
        },
      });
      toast.success(`Account created for ${name.trim()}`);
      reset();
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(errorMessage(err, "Could not create the account"), { duration: Infinity });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Add staff
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a staff account</DialogTitle>
          <DialogDescription>
            Set an initial password and share it with them directly, they can change it after signing
            in, and reset it themselves later if they have an email on file.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarah Moyo" />
          </div>
          <div className="grid gap-2">
            <Label>Do they have a work email?</Label>
            <ChipGroup
              size="sm"
              ariaLabel="Has email"
              value={hasEmail ? "yes" : "no"}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No, sign in with name" },
              ]}
              onChange={(v) => setHasEmail(v === "yes")}
            />
          </div>
          {hasEmail && (
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label>Initial password</Label>
            <Input
              type="text"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <ChipGroup
              size="sm"
              ariaLabel="Role"
              value={role}
              options={ROLE_OPTIONS}
              onChange={(v) => setRole(v)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}