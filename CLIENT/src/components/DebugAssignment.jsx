import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import api from '../config/api';

const DebugAssignment = () => {
  const { currentUser } = useUser();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAssignment = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const userId = currentUser?.Id || currentUser?.id || currentUser?.userId ||
                      (Array.isArray(currentUser?.Username) ? currentUser.Username[0] : currentUser?.Username);

        if (userId) {
          const response = await api.get(`/api/hierarchical-rbac/assignments/${userId}`);
          setAssignment(response.data.assignment);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAssignment();
  }, [currentUser]);

  if (loading) return <div>Loading assignment...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!assignment) return <div>No assignment found</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>🔍 User Assignment Debug Information</h2>

      <h3>Assignment Details:</h3>
      <pre>{JSON.stringify(assignment, null, 2)}</pre>

      <h3>Workflow Roles:</h3>
      <pre>{JSON.stringify(assignment.workflowRoles || [], null, 2)}</pre>

      <h3>Assignment Level:</h3>
      <pre>{JSON.stringify(assignment.assignmentLevel, null, 2)}</pre>

      <h3>Has regionCreator in workflowRoles:</h3>
      <pre>{JSON.stringify(
        (assignment.workflowRoles || []).includes('regionCreator'),
        null, 2
      )}</pre>
    </div>
  );
};

export default DebugAssignment;