import { s } from '../adminStyles';
import { SectionHeader, LoadingState, EmptyMsg, ErrorBar } from './AdminPrimitives';
import { UsersTable } from '../tables/UsersTable';

export default function AdminUsersSection({
  users, usersLoading, usersError,
  loadUsers, handleRoleChange, handleBanToggle,
  changingRole, td,
}) {
  return (
    <>
      <SectionHeader
        title={td.usersTitle}
        sub={usersLoading ? td.loadingDots : td.usersCount(users.length)}
      />
      {usersError && <ErrorBar msg={usersError} onRetry={loadUsers} />}
      {usersLoading ? (
        <LoadingState label={td.loadingUsers} />
      ) : users.length > 0 ? (
        <UsersTable
          users={users}
          onRoleChange={handleRoleChange}
          onBanToggle={handleBanToggle}
          changingRole={changingRole}
        />
      ) : (
        <EmptyMsg text={td.noUsers} />
      )}
    </>
  );
}
