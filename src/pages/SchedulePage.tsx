import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { mockSchedule } from "@/lib/mock-data";
import { Plus, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

export default function SchedulePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
            <p className="text-sm text-muted-foreground mt-1">Time-based content scheduling</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Schedule
          </Button>
        </div>

        {/* Weekly Grid */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Weekly Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="grid grid-cols-8 gap-px bg-border rounded-lg overflow-hidden min-w-[600px]">
                <div className="bg-card p-2" />
                {days.map(day => (
                  <div key={day} className="bg-card p-2 text-center text-xs font-semibold">{day}</div>
                ))}
                {[6, 8, 10, 12, 14, 16, 18, 20].map(hour => (
                  <>
                    <div key={`h-${hour}`} className="bg-card p-2 text-xs text-muted-foreground text-right">
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                    {days.map(day => {
                      const event = mockSchedule.find(s => {
                        const start = parseInt(s.startTime);
                        const end = parseInt(s.endTime);
                        const hasDay = s.days.includes(day);
                        if (start < end) return hasDay && hour >= start && hour < end;
                        return hasDay && (hour >= start || hour < end);
                      });
                      return (
                        <div key={`${day}-${hour}`} className={`bg-card p-1 min-h-[32px] ${event ? 'bg-primary/10' : ''}`}>
                          {event && hour === parseInt(event.startTime) && (
                            <span className="text-[10px] font-medium text-primary truncate block">{event.playlistName}</span>
                          )}
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">All Schedules</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Playlist</TableHead>
                  <TableHead>Screen Group</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockSchedule.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{event.playlistName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{event.screenGroup}</TableCell>
                    <TableCell className="text-sm font-mono">{event.startTime} – {event.endTime}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {event.days.map(d => (
                          <span key={d} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">{d}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={event.priority} /></TableCell>
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
