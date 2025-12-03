import { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, List, ListItem, ListItemText, IconButton, Card, Chip } from '@mui/material';
import { FiEdit, FiTrash2, FiShare2, FiSave, FiX } from 'react-icons/fi';
import { useTheme, useMediaQuery } from '@mui/material';

export default function FloatingNotes() {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [linkedItem, setLinkedItem] = useState(null);

  // Load notes from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('floatingNotes') || '[]');
      setNotes(stored);
    } catch (e) {}
  }, []);

  // Persist notes to localStorage
  useEffect(() => {
    localStorage.setItem('floatingNotes', JSON.stringify(notes));
  }, [notes]);

  const addNote = () => {
    if (!newNote.trim()) return;
    const note = {
      id: `note-${Date.now()}`,
      text: newNote,
      timestamp: new Date(),
      linkedItem: linkedItem,
      shared: false
    };
    setNotes([note, ...notes]);
    setNewNote('');
    setLinkedItem(null);
  };

  const updateNote = (id, text) => {
    setNotes(notes.map(n => n.id === id ? { ...n, text, timestamp: new Date() } : n));
    setEditingId(null);
    setEditingText('');
  };

  const deleteNote = (id) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  const shareNote = (id) => {
    const note = notes.find(n => n.id === id);
    if (note) {
      const text = `Note: ${note.text} (${note.timestamp.toLocaleString()})`;
      if (navigator.share) {
        navigator.share({ title: 'Shared Note', text });
      } else {
        navigator.clipboard.writeText(text);
        window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Note copied to clipboard', type: 'success' } }));
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#1a1a1e', color: '#eee', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <FiEdit size={20} />
        <Typography variant='subtitle1'>Quick Notes</Typography>
      </Box>

      {/* New Note Input */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <TextField
          placeholder='Add a new note...'
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          multiline
          rows={2}
          fullWidth
          size='small'
          sx={{
            mb: 1,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.05)',
              color: '#eee',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }
            }
          }}
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={addNote}
            variant='contained'
            size='small'
            disabled={!newNote.trim()}
            sx={{ flex: 1 }}
          >
            Add Note
          </Button>
        </Box>
      </Box>

      {/* Notes List */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {notes.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <FiEdit size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <Typography variant='body2'>No notes yet</Typography>
          </Box>
        ) : (
          <List sx={{ p: 1 }}>
            {notes.map((note) => (
              <ListItem
                key={note.id}
                sx={{
                  mb: 1,
                  bgcolor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 1,
                  p: 1.5,
                  display: 'block'
                }}
              >
                {editingId === note.id ? (
                  <Box>
                    <TextField
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      multiline
                      rows={2}
                      fullWidth
                      size='small'
                      sx={{
                        mb: 1,
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(255,255,255,0.05)',
                          color: '#eee'
                        }
                      }}
                    />
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button
                        onClick={() => updateNote(note.id, editingText)}
                        variant='contained'
                        size='small'
                        startIcon={<FiSave size={14} />}
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => setEditingId(null)}
                        variant='outlined'
                        size='small'
                      >
                        Cancel
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box>
                    <Typography variant='body2' sx={{ mb: 0.75, wordBreak: 'break-word' }}>
                      {note.text}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        {note.timestamp.toLocaleString()}
                      </Typography>
                      {note.linked Item && (
                        <Chip
                          label={`Linked to ${note.linkedItem.type}`}
                          size='small'
                          sx={{ height: 18, fontSize: '9px' }}
                        />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size='small'
                        onClick={() => {
                          setEditingId(note.id);
                          setEditingText(note.text);
                        }}
                        sx={{ color: '#aaa' }}
                      >
                        <FiEdit size={14} />
                      </IconButton>
                      <IconButton
                        size='small'
                        onClick={() => shareNote(note.id)}
                        sx={{ color: '#aaa' }}
                      >
                        <FiShare2 size={14} />
                      </IconButton>
                      <IconButton
                        size='small'
                        onClick={() => deleteNote(note.id)}
                        sx={{ color: '#aaa' }}
                      >
                        <FiTrash2 size={14} />
                      </IconButton>
                    </Box>
                  </Box>
                )}
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
