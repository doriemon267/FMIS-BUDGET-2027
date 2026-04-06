/**
 * Comments/Annotations Component for Proposals
 */

import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Avatar,
  Chip,
  Divider,
  IconButton,
} from '@mui/material';
import { Send, Edit, Delete } from '@mui/icons-material';
import { useState, useEffect } from 'react';
// Simple relative time formatter (no date-fns dependency)
const formatDistanceToNow = (date) => {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  
  return past.toLocaleDateString();
};
import api from '../../config/api';
import { useUser } from '../../context/UserContext';
import logger from '../../utils/logger';

const ProposalComments = ({ proposalId, onCommentAdded }) => {
  const { currentUser } = useUser();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    if (proposalId) {
      fetchComments();
    }
  }, [proposalId]);

  const fetchComments = async () => {
    try {
      const response = await api.get(`/api/proposals/${proposalId}/comments`);
      if (response.data?.success) {
        setComments(response.data.data || []);
      }
    } catch (error) {
      logger.error('Failed to fetch comments', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const response = await api.post(`/api/proposals/${proposalId}/comments`, {
        text: newComment,
        type: 'comment', // 'comment' or 'annotation'
      });

      if (response.data?.success) {
        setComments([response.data.data, ...comments]);
        setNewComment('');
        if (onCommentAdded) {
          onCommentAdded(response.data.data);
        }
      }
    } catch (error) {
      logger.error('Failed to add comment', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditComment = async (commentId) => {
    if (!editText.trim()) return;

    try {
      const response = await api.put(`/api/proposals/${proposalId}/comments/${commentId}`, {
        text: editText,
      });

      if (response.data?.success) {
        setComments(
          comments.map((c) => (c._id === commentId ? response.data.data : c))
        );
        setEditingId(null);
        setEditText('');
      }
    } catch (error) {
      logger.error('Failed to edit comment', error);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await api.delete(`/api/proposals/${proposalId}/comments/${commentId}`);

      if (response.data?.success) {
        setComments(comments.filter((c) => c._id !== commentId));
      }
    } catch (error) {
      logger.error('Failed to delete comment', error);
    }
  };

  const canEdit = (comment) => {
    return (
      currentUser?.Id === comment.userId ||
      currentUser?.Roles?.includes('SUPER_ADMIN')
    );
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Comments & Annotations
      </Typography>

      {/* Add Comment */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          multiline
          rows={3}
          placeholder="Add a comment or annotation..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          sx={{ mb: 1 }}
        />
        <Button
          variant="contained"
          startIcon={<Send />}
          onClick={handleAddComment}
          disabled={loading || !newComment.trim()}
          size="small"
        >
          Add Comment
        </Button>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Comments List */}
      <Stack spacing={2}>
        {comments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            No comments yet. Be the first to comment!
          </Typography>
        ) : (
          comments.map((comment) => (
            <Box key={comment._id} sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                  {comment.userName?.charAt(0)?.toUpperCase() || 'U'}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {comment.userName || 'Unknown User'}
                    </Typography>
                    {comment.type === 'annotation' && (
                      <Chip label="Annotation" size="small" color="info" />
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </Typography>
                  </Stack>
                  {editingId === comment._id ? (
                    <Box>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        sx={{ mb: 1 }}
                      />
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleEditComment(comment._id)}
                        >
                          Save
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            setEditingId(null);
                            setEditText('');
                          }}
                        >
                          Cancel
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    <>
                      <Typography variant="body2">{comment.text}</Typography>
                      {canEdit(comment) && (
                        <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingId(comment._id);
                              setEditText(comment.text);
                            }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteComment(comment._id)}
                            color="error"
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                      )}
                    </>
                  )}
                </Box>
              </Stack>
            </Box>
          ))
        )}
      </Stack>
    </Paper>
  );
};

export default ProposalComments;
