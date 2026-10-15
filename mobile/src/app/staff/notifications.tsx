import { NoticeList } from "@/components/notice-list";
import { useSession } from "@/session";

export default function StaffNotificationsScreen() {
  const { user } = useSession();
  if (!user) {
    return null;
  }
  return <NoticeList base="/register/notifications" role={user.role} back="/staff" staff />;
}
