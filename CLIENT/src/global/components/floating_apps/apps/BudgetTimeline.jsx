import { useState, useEffect } from 'react';
import { Box, Typography, Card, Grid, Chip, CircularProgress, Button, Dialog, DialogTitle, DialogContent } from '@mui/material';
import { FiCalendar, FiClock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { useTheme, useMediaQuery } from '@mui/material';
import { api } from '../../../services/api';

export default function BudgetTimeline() {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchTimeline();
  }, []);

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/budget-timeline');
      if (response?.data?.events) {
        // Sort by date
        const sorted = response.data.events.sort((a, b) => new Date(a.date) - new Date(b.date));
        setEvents(sorted);
      }
    } catch (e) {
      console.error('[BudgetTimeline] Failed to fetch events:', e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#43a047';
      case 'upcoming': return '#0066cc';
      case 'overdue': return '#d32f2f';
      case 'in-progress': return '#f57c00';
      default: return '#9c27b0';
    }
  };

  const getStatusIcon = (status) => {
    const props = { size: 16 };
    switch (status) {
      case 'completed': return <FiCheckCircle {...props} />;
      case 'overdue': return <FiAlertCircle {...props} />;
      default: return <FiClock {...props} />;
    }
  };

  const isToday = (date) => {
    const today = new Date();
    return new Date(date).toDateString() === today.toDateString();
  };

  const isSoon = (date) => {
    const today = new Date();
    const eventDate = new Date(date);
    const diffTime = eventDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', bgcolor: '#1a1a1e', color: '#eee' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#1a1a1e', color: '#eee', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <FiCalendar size={20} />
        <Typography variant='subtitle1'>Budget Timeline</Typography>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {events.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <FiCalendar size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <Typography variant='body2'>No events scheduled</Typography>
          </Box>
        ) : (
          <Box sx={{ position: 'relative' }}>
            {/* Timeline line */}
            <Box sx={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, bgcolor: 'rgba(255,255,255,0.1)' }} />

            {/* Events */}
            {events.map((event, idx) => (
              <Box
                key={event.id}
                sx={{
                  mb: 2,
                  pl: 6,
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { transform: 'translateX(4px)' }
                }}
                onClick={() => {
                  setSelectedEvent(event);
                  setDialogOpen(true);
                }}
              >
                {/* Timeline dot */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: 7,
                    top: 2,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    bgcolor: getStatusColor(event.status),
                    border: '3px solid #1a1a1e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff'
                  }}
                >
                  {getStatusIcon(event.status)}
                </Box>

                {/* Event Card */}
                <Card
                  sx={{
                    bgcolor: 'rgba(0,0,0,0.3)',
                    border: `2px solid ${getStatusColor(event.status)}33`,
                    p: 1.5,
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.5)',
                      borderColor: getStatusColor(event.status)
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography variant='body2' sx={{ fontWeight: 600 }}>
                      {event.title}
                    </Typography>
                    <Chip
                      label={event.status}
                      size='small'
                      sx={{
                        height: 18,
                        fontSize: '10px',
                        bgcolor: getStatusColor(event.status),
                        color: '#fff'
                      }}
                    />
                  </Box>

                  <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>
                    {event.description}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                    <FiClock size={12} />
                    <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      {new Date(event.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Typography>
                    {isToday(event.date) && (
                      <Chip label='Today' size='small' sx={{ height: 16, fontSize: '9px', ml: 'auto' }} />
                    )}
                    {isSoon(event.date) && !isToday(event.date) && (
                      <Chip label='This week' size='small' sx={{ height: 16, fontSize: '9px', ml: 'auto' }} />
                    )}
                  </Box>

                  {event.stage && (
                    <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.5)' }}>
                      {event.stage}
                    </Typography>
                  )}
                </Card>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Event Details Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth>
        {selectedEvent && (
          <>
            <DialogTitle>{selectedEvent.title}</DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant='caption' sx={{ color: 'rgba(0,0,0,0.6)' }}>Status</Typography>
                  <Chip
                    label={selectedEvent.status}
                    sx={{
                      bgcolor: getStatusColor(selectedEvent.status),
                      color: '#fff',
                      mt: 0.5
                    }}
                  />
                </Box>

                <Box>
                  <Typography variant='caption' sx={{ color: 'rgba(0,0,0,0.6)' }}>Date</Typography>
                  <Typography variant='body2' sx={{ mt: 0.5 }}>
                    {new Date(selectedEvent.date).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </Typography>
                </Box>

                {selectedEvent.description && (
                  <Box>
                    <Typography variant='caption' sx={{ color: 'rgba(0,0,0,0.6)' }}>Description</Typography>
                    <Typography variant='body2' sx={{ mt: 0.5 }}>
                      {selectedEvent.description}
                    </Typography>
                  </Box>
                )}

                {selectedEvent.stage && (
                  <Box>
                    <Typography variant='caption' sx={{ color: 'rgba(0,0,0,0.6)' }}>Stage</Typography>
                    <Typography variant='body2' sx={{ mt: 0.5 }}>
                      {selectedEvent.stage}
                    </Typography>
                  </Box>
                )}

                {selectedEvent.actionUrl && (
                  <Button
                    variant='contained'
                    onClick={() => window.location.href = selectedEvent.actionUrl}
                  >
                    View Details
                  </Button>
                )}
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}
