import { ADMIN_TOP_HASHES, isAdminBillingPageHash, isAdminHelpPageHash, isAdminNotificationPageHash } from "./adminTopHashes";
import { AdminProfilePage } from "./profile/AdminProfilePage";
import { AdminStaffManagementPage } from "./AdminStaffManagementPage";
import { AdminBillingPageRouter } from "./billing/AdminBillingPages";
import { AdminHelpPageRouter } from "./help/AdminHelpPages";
import { AdminNotificationPageRouter } from "./notifications/AdminNotificationPages";

export function AdminAddStaffPage({
  token,
  restaurantId,
  venueName
}: {
  token: string;
  restaurantId: string;
  venueName: string;
}) {
  return <AdminStaffManagementPage token={token} restaurantId={restaurantId} venueName={venueName} />;
}

export function AdminTopPageView({
  hash,
  token,
  displayName,
  email,
  restaurantId,
  venueName,
  onSignOut,
  onEmailChanged
}: {
  hash: string;
  token: string;
  displayName: string;
  email?: string | null;
  restaurantId: string;
  venueName: string;
  onSignOut?: () => void;
  onEmailChanged?: (email: string) => void;
}) {
  switch (hash) {
    case ADMIN_TOP_HASHES.addStaff:
      return (
        <AdminStaffManagementPage token={token} restaurantId={restaurantId} venueName={venueName} />
      );
    case ADMIN_TOP_HASHES.profile:
      return (
        <AdminProfilePage
          token={token}
          displayName={displayName}
          email={email}
          onSignOut={onSignOut}
          onEmailChanged={onEmailChanged}
        />
      );
    default:
      if (isAdminHelpPageHash(hash)) {
        return <AdminHelpPageRouter hash={hash} />;
      }
      if (isAdminBillingPageHash(hash)) {
        return <AdminBillingPageRouter hash={hash} />;
      }
      if (isAdminNotificationPageHash(hash) || hash === ADMIN_TOP_HASHES.notifications) {
        return <AdminNotificationPageRouter hash={hash} token={token} restaurantId={restaurantId} />;
      }
      return null;
  }
}
