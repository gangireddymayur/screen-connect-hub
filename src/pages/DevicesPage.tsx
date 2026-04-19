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
  const filtered = mockDevices.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your display screens</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Pair Device
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pair New Device</DialogTitle>
                <DialogDescription>Enter the pairing code shown on your TV screen</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Device Pairing Code</span>
                </div>
                <Input placeholder="XXXX-XXXX" className="text-center text-2xl tracking-[0.5em] font-mono" />
                <Button className="w-full">Link Device</Button>
              </div>
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
