import { useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { DenseRow } from "@/components/dense-row";
import { PagedList } from "@/components/paged-list";
import { pageQuery } from "@/list-page";
import { useListPage } from "@/use-list-page";
import { useSession } from "@/session";
import { readActivity, readTotal, trimStop, type GateEvent } from "@/staff";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export default function GateHistoryScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { staffRequest } = useSession();
  const list = useListPage<GateEvent>({
    auto: false,
    idOf: (item) => item.key,
    loadPage: async (offset) => {
      const reply = await staffRequest(`/gate/activity?${pageQuery(offset)}`);
      if (!reply.ok) {
        return { error: trimStop(reply.message) };
      }
      return {
        items: readActivity(reply.data, offset),
        total: readTotal(reply.data),
      };
    },
  });

  useFocusEffect(
    useCallback(() => {
      list.load();
    }, [list.load]),
  );

  const back = () => goBackOr(navigation, "/staff/settings");

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.inkFaint} />
      }
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
        <BackMark color={colors.inkSoft} />
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Gate history</Text>
      <Text style={[text.body, { color: colors.inkSoft }]}>Everyone recorded at the gate, newest first</Text>
      <View style={styles.list}>
        <PagedList
          rows={list.rows}
          error={list.error}
          pageError={list.pageError}
          showListSkeleton={list.showListSkeleton}
          showPageSkeleton={list.showPageSkeleton}
          onRetry={list.rows && list.rows.length > 0 ? list.refresh : list.retry}
          onRetryPage={() => list.loadNext(true)}
          empty={<Text style={[text.body, { color: colors.inkFaint }]}>No one has passed the gate yet</Text>}
          footer={
            list.hasMore && !list.showPageSkeleton ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show older"
                onPress={() => list.loadNext()}
                hitSlop={12}
                style={styles.older}
              >
                <Text style={[text.button, { color: colors.forest }]}>Show older</Text>
              </Pressable>
            ) : null
          }
        >
          <View>
            {(list.rows ?? []).map((item, index, all) => (
              <DenseRow
                key={item.key}
                title={item.title}
                detail={item.detail}
                time={item.at}
                first={index === 0}
                last={index === all.length - 1}
              />
            ))}
          </View>
        </PagedList>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28, gap: 16 },
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", marginLeft: -6 },
  title: { textAlign: "left" },
  list: { marginTop: 12 },
  older: { alignSelf: "flex-start", paddingVertical: 12 },
});
