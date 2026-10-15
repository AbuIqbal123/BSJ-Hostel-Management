import { NoticeList } from "@/components/notice-list";

export default function NotificationsScreen() {
  return <NoticeList base="/me/notifications" role="resident" back="/home" staff={false} />;
}
