import { type ReactElement, type ReactNode } from "react";
import { FlatList, SectionList, type FlatListProps, type SectionListProps } from "react-native";

import { EmptyState, ListError, RetryRow } from "@/components/list-state";
import { SkeletonRows } from "@/components/skeleton";

type Chrome = {
  rows: unknown[] | null;
  error: string | null;
  pageError: string | null;
  showListSkeleton: boolean;
  showPageSkeleton: boolean;
  filling?: boolean;
  onRetry: () => void;
  onRetryPage: () => void;
  empty?: ReactNode;
  skeletonCount?: number;
  skeletonKind?: "card" | "row";
  header?: ReactElement | null;
  footer?: ReactNode;
};

function emptyNode(empty: ReactNode | undefined): ReactElement | null {
  if (empty == null || empty === false || typeof empty === "boolean" || typeof empty === "number") {
    return null;
  }
  if (typeof empty === "string") {
    return <EmptyState message={empty} />;
  }
  return <>{empty}</>;
}

function ListChrome({
  rows,
  error,
  pageError,
  showListSkeleton,
  showPageSkeleton,
  filling,
  onRetry,
  onRetryPage,
  empty,
  skeletonCount = 4,
  skeletonKind = "row",
  header,
  footer,
  children,
}: Chrome & { children?: ReactNode }) {
  const count = rows?.length ?? 0;
  const showEmpty = !showListSkeleton && !showPageSkeleton && !filling && rows !== null && count === 0 && !error;
  return (
    <>
      {header}
      {showListSkeleton ? <SkeletonRows count={skeletonCount} kind={skeletonKind} /> : null}
      {error && count === 0 ? <ListError message={error} onRetry={onRetry} /> : null}
      {error && count > 0 ? <ListError message={error} onRetry={onRetry} /> : null}
      {showListSkeleton ? null : children}
      {showEmpty ? emptyNode(empty) : null}
      {footer}
      {showPageSkeleton ? <SkeletonRows count={1} kind={skeletonKind} /> : null}
      {pageError ? <RetryRow message={pageError} onRetry={onRetryPage} /> : null}
    </>
  );
}

type StackProps = Chrome & { kind?: "stack"; children: ReactNode };

type FlatProps<T> = Chrome & {
  kind: "flat";
  data: T[];
  renderItem: FlatListProps<T>["renderItem"];
  keyExtractor: (item: T, index: number) => string;
  onEndReached?: () => void;
  refreshControl?: FlatListProps<T>["refreshControl"];
  contentContainerStyle?: FlatListProps<T>["contentContainerStyle"];
  style?: FlatListProps<T>["style"];
  ItemSeparatorComponent?: FlatListProps<T>["ItemSeparatorComponent"];
  keyboardShouldPersistTaps?: FlatListProps<T>["keyboardShouldPersistTaps"];
  keyboardDismissMode?: FlatListProps<T>["keyboardDismissMode"];
  showsVerticalScrollIndicator?: boolean;
  onLayout?: FlatListProps<T>["onLayout"];
  onContentSizeChange?: FlatListProps<T>["onContentSizeChange"];
  initialNumToRender?: number;
  windowSize?: number;
  extraData?: unknown;
};

type SectionProps<T, S extends { data: T[] }> = Chrome & {
  kind: "section";
  sections: S[];
  renderItem: SectionListProps<T, S>["renderItem"];
  renderSectionHeader?: SectionListProps<T, S>["renderSectionHeader"];
  keyExtractor: (item: T, index: number) => string;
  onEndReached?: () => void;
  refreshControl?: SectionListProps<T, S>["refreshControl"];
  contentContainerStyle?: SectionListProps<T, S>["contentContainerStyle"];
  style?: SectionListProps<T, S>["style"];
  stickySectionHeadersEnabled?: boolean;
  keyboardShouldPersistTaps?: SectionListProps<T, S>["keyboardShouldPersistTaps"];
  keyboardDismissMode?: SectionListProps<T, S>["keyboardDismissMode"];
  onLayout?: SectionListProps<T, S>["onLayout"];
  onContentSizeChange?: SectionListProps<T, S>["onContentSizeChange"];
  ListEmptyComponent?: SectionListProps<T, S>["ListEmptyComponent"];
  initialNumToRender?: number;
  windowSize?: number;
  extraData?: unknown;
};

export function PagedList<T, S extends { data: T[] }>(props: StackProps | FlatProps<T> | SectionProps<T, S>) {
  const count = props.rows?.length ?? 0;
  const showEmpty =
    !props.showListSkeleton && !props.showPageSkeleton && !props.filling && props.rows !== null && count === 0 && !props.error;
  if (props.kind === "flat") {
    return (
      <FlatList
        style={props.style}
        contentContainerStyle={props.contentContainerStyle}
        data={props.showListSkeleton ? [] : props.data}
        keyExtractor={props.keyExtractor}
        renderItem={props.renderItem}
        ItemSeparatorComponent={props.ItemSeparatorComponent}
        keyboardShouldPersistTaps={props.keyboardShouldPersistTaps}
        keyboardDismissMode={props.keyboardDismissMode}
        showsVerticalScrollIndicator={props.showsVerticalScrollIndicator}
        refreshControl={props.refreshControl}
        onEndReachedThreshold={0.5}
        onEndReached={props.onEndReached}
        onLayout={props.onLayout}
        onContentSizeChange={props.onContentSizeChange}
        initialNumToRender={props.initialNumToRender}
        windowSize={props.windowSize}
        extraData={props.extraData}
        ListHeaderComponent={
          <>
            {props.header}
            {props.error && count > 0 ? <ListError message={props.error} onRetry={props.onRetry} /> : null}
          </>
        }
        ListEmptyComponent={
          props.showListSkeleton ? (
            <SkeletonRows count={props.skeletonCount ?? 4} kind={props.skeletonKind ?? "row"} />
          ) : props.error && count === 0 ? (
            <ListError message={props.error} onRetry={props.onRetry} />
          ) : showEmpty ? (
            emptyNode(props.empty)
          ) : null
        }
        ListFooterComponent={
          <>
            {props.footer}
            {props.showPageSkeleton ? <SkeletonRows count={1} kind={props.skeletonKind ?? "row"} /> : null}
            {props.pageError ? <RetryRow message={props.pageError} onRetry={props.onRetryPage} /> : null}
          </>
        }
      />
    );
  }
  if (props.kind === "section") {
    return (
      <SectionList
        style={props.style}
        contentContainerStyle={props.contentContainerStyle}
        sections={props.showListSkeleton ? [] : props.sections}
        keyExtractor={props.keyExtractor}
        renderItem={props.renderItem}
        renderSectionHeader={props.renderSectionHeader}
        stickySectionHeadersEnabled={props.stickySectionHeadersEnabled}
        keyboardShouldPersistTaps={props.keyboardShouldPersistTaps}
        keyboardDismissMode={props.keyboardDismissMode}
        refreshControl={props.refreshControl}
        onEndReachedThreshold={0.5}
        onEndReached={props.onEndReached}
        onLayout={props.onLayout}
        onContentSizeChange={props.onContentSizeChange}
        initialNumToRender={props.initialNumToRender}
        windowSize={props.windowSize}
        extraData={props.extraData}
        ListHeaderComponent={
          <>
            {props.header}
            {props.showListSkeleton ? (
              <SkeletonRows count={props.skeletonCount ?? 4} kind={props.skeletonKind ?? "row"} />
            ) : null}
            {props.error ? <ListError message={props.error} onRetry={props.onRetry} /> : null}
          </>
        }
        ListEmptyComponent={
          props.ListEmptyComponent ??
          (showEmpty ? emptyNode(props.empty) : null)
        }
        ListFooterComponent={
          <>
            {props.footer}
            {props.showPageSkeleton ? <SkeletonRows count={1} kind={props.skeletonKind ?? "row"} /> : null}
            {props.pageError ? <RetryRow message={props.pageError} onRetry={props.onRetryPage} /> : null}
          </>
        }
      />
    );
  }
  return <ListChrome {...props}>{props.children}</ListChrome>;
}
