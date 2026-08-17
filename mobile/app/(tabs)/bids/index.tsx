import { useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useAuthStore } from "../../../src/store/authStore";
import api from "../../../src/services/api";
import { colors } from "../../../src/theme/colors";

interface BidItem {
  id: string; request_id: string; request_title: string;
  goods_amount: number; service_fee: number; platform_fee: number; total_amount: number;
  delivery_at: string | null; status: string; created_at: string;
}

const ACTIVE_STATUSES = ["accepted", "payment_made", "in_progress"];

export default function MyBidsScreen() {
  const user = useAuthStore((s) => s.user);
  const dark = user?.role === 'errander';
  const [refreshing, setRefreshing] = useState(false);

  const { data: bids = [], isLoading, refetch } = useQuery<BidItem[]>({
    queryKey: ["my-bids"],
    queryFn: async () => {
      const { data } = await api.get("/my/bids");
      return data.data;
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const statusColor = (status: string) => {
    switch (status) {
      case "accepted":
      case "payment_made":
      case "in_progress":
      case "completed":
        return colors.primary[500];
      case "rejected":
      case "withdrawn":
        return colors.error;
      default:
        return colors.neutral[400];
    }
  };

  const statusLabel = (status: string) => status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{dark ? "My Errands" : "My Bids"}</Text>
      <FlatList
        data={bids}
        keyExtractor={(item: BidItem) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
        contentContainerStyle={bids.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          isLoading ? (
            <Text style={styles.emptyText}>Loading...</Text>
          ) : (
            <Text style={styles.emptyText}>No bids yet. Browse the feed to find requests.</Text>
          )
        }
        renderItem={({ item }: { item: BidItem }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => router.push(ACTIVE_STATUSES.includes(item.status) ? `/jobs/${item.id}` : `/requests/${item.request_id}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.requestTitle} numberOfLines={1}>{item.request_title ?? "Request"}</Text>
              <Text style={[styles.status, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Goods:</Text>
              <Text style={styles.value}>₦{item.goods_amount?.toLocaleString()}</Text>
              <Text style={styles.label}>Service:</Text>
              <Text style={styles.value}>₦{item.service_fee?.toLocaleString()}</Text>
              <Text style={styles.label}>Total:</Text>
              <Text style={[styles.value, styles.total]}>₦{item.total_amount?.toLocaleString()}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50], paddingTop: 56 },
  title: { fontSize: 17, fontWeight: "700", paddingHorizontal: 20, marginBottom: 12, color: colors.secondary[500], letterSpacing: -0.1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: colors.neutral[400], fontSize: 14, textAlign: "center", padding: 32 },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.neutral[100] },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  requestTitle: { fontSize: 13.5, fontWeight: "700", color: colors.secondary[500], flex: 1, marginRight: 8 },
  status: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  label: { fontSize: 12, color: colors.neutral[400] },
  value: { fontSize: 12, fontWeight: "500", color: colors.neutral[500] },
  total: { fontWeight: "700", color: colors.primary[500] },
});
