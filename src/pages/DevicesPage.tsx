import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { mockDevices } from "@/lib/mock-data";
import { Monitor, Plus, MoreVertical, Tv, Pencil, ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "@/hooks/use-toast";

export default function DevicesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [pairOpen, setPairOpen] = useState(false);
  const [code, setCode] = useState('');
  const [pairing, setPairing] = useState(false);
  const [paired, setPaired] = useState(false);

  const filtered = mockDevices.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.location.toLowerCase().includes(search.toLowerCase())
  );

  const handlePair = async () => {
    if (code.length !== 6) return;
    setPairing(true);
    await new Promise(r => setTimeout(r, 900));
    setPairing(false);
    setPaired(true);
    toast({ title: "Device paired", description: `Code ${code.toUpperCase()} linked successfully.` });
    setTimeout(() => {
      setPairOpen(false);
      setPaired(false);
      setCode('');
    }, 1200);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your display screens</p>
          </div>
          <Dialog open={pairOpen} onOpenChange={(o) => { setPairOpen(o); if (!o) { setCode(''); setPaired(false); } }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Pair Device
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl">Pair a new TV</DialogTitle>
                <DialogDescription>
                  Open SignageHub on your TV — it will display a 6-character pairing code. Enter it below to link the screen to your account.
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-center gap-3 py-4">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="h-12 w-16 rounded-md border-2 border-primary/40 bg-primary/5 flex items-center justify-center">
                    <Tv className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">TV shows code</span>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="flex flex-col items-center gap-1.5">
                  <div className="h-12 w-16 rounded-md border-2 border-primary bg-primary/10 flex items-center justify-center">
                    <Monitor className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-primary font-medium">You enter here</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium block text-center">Pairing code</label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(v) => setCode(v.toUpperCase())}
                    pattern="^[A-Za-z0-9]+$"
                    disabled={pairing || paired}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="h-12 w-11 text-lg font-mono" />
                      <InputOTPSlot index={1} className="h-12 w-11 text-lg font-mono" />
                      <InputOTPSlot index={2} className="h-12 w-11 text-lg font-mono" />
                      <InputOTPSlot index={3} className="h-12 w-11 text-lg font-mono" />
                      <InputOTPSlot index={4} className="h-12 w-11 text-lg font-mono" />
                      <InputOTPSlot index={5} className="h-12 w-11 text-lg font-mono" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Code is case-insensitive · Expires in 10 minutes
                </p>
              </div>

              <DialogFooter className="sm:justify-between gap-2 pt-2">
                <Button variant="ghost" onClick={() => setPairOpen(false)} disabled={pairing}>Cancel</Button>
                <Button onClick={handlePair} disabled={code.length !== 6 || pairing || paired} className="min-w-[130px]">
                  {paired ? (<><CheckCircle2 className="h-4 w-4 mr-2" />Paired</>) : pairing ? "Pairing..." : "Pair device"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-3">
          <Input
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead>Playlist</TableHead>
                  <TableHead>Uptime</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((device) => (
                  <TableRow key={device.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{device.name}</p>
                          <p className="text-xs text-muted-foreground">{device.location}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{device.group}</TableCell>
                    <TableCell className="text-sm font-mono text-xs">{device.resolution}</TableCell>
                    <TableCell className="text-sm">{device.playlist || <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                    <TableCell className="text-sm">{device.uptime}%</TableCell>
                    <TableCell><StatusBadge status={device.status} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/editor/${device.id}`)} title="Edit Screen Layout">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
