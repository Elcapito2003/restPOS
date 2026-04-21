export type RootStackParamList = {
  Tables: undefined;
  Order: { tableId: number | null; tableLabel: string; floorId: number | null; orderId?: number };
  Menu: { orderId: number | null; tableId: number | null; tableLabel: string };
};
