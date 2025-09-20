import React from 'react';
import { useUser } from '../context/UserContext';

const DebugUserAccess = () => {
  const { currentUser } = useUser();

  if (!currentUser) {
    return <div>No user logged in</div>;
  }

  const hierarchicalAccess = currentUser.hierarchicalAccess;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>🔍 User Access Debug Information</h2>

      <h3>User Info:</h3>
      <pre>{JSON.stringify({
        userId: currentUser.Id || currentUser.id,
        username: currentUser.Username,
        roles: currentUser.Roles,
        assignmentLevel: currentUser.assignmentLevel
      }, null, 2)}</pre>

      <h3>Hierarchical Access:</h3>
      <pre>{JSON.stringify(hierarchicalAccess, null, 2)}</pre>

      <h3>Workflow Roles:</h3>
      <pre>{JSON.stringify(hierarchicalAccess?.workflowRoles || [], null, 2)}</pre>

      <h3>Role Permissions:</h3>
      <pre>{JSON.stringify(hierarchicalAccess?.rolePermissions || {}, null, 2)}</pre>

      <h3>Has regionCreator Role:</h3>
      <pre>{JSON.stringify(
        (hierarchicalAccess?.workflowRoles || []).includes('regionCreator'),
        null, 2
      )}</pre>

      <h3>Has ManageSettings Permission:</h3>
      <pre>{JSON.stringify(
        hierarchicalAccess?.rolePermissions?.ManageSettings,
        null, 2
      )}</pre>
    </div>
  );
};

export default DebugUserAccess;