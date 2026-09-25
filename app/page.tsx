"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  connectGoogleDrive,
  downloadBackup,
  getExistingOwnerBackup,
  pickBackupFile,
  prepareOwnerBackup,
  reconnectGoogleDriveSilently,
  uploadOwnerBackup,
  type DriveConnection,
  type DriveRole,
} from "./google-drive";
const PUBLIC_BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
type C = {
  id: number;
  name: string;
  chineseName?: string;
  phone: string;
  address: string;
  occupation: string;
  birthday: string;
  notes: string;
  frameColor: string;
  profileColor: string;
};
type A = {
  id: number;
  customerId: number;
  customerName: string;
  service: string;
  addons: string;
  coupons: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  status: string;
  note: string;
  label?: string;
  color?: string;
  repeatGroup?: string;
  servicePrice?: number;
  addonPrices?: string;
  couponDiscounts?: string;
  personal?: boolean;
  endDate?: string;
  endTime?: string;
  allDay?: boolean;
};
type Item = {
  id: number;
  name: string;
  duration: number;
  price: number;
  active: number;
};
type Coupon = { id: number; name: string; discount: number; active: number };
type FinanceCategory =
  | "房租"
  | "費用"
  | "耗材"
  | "設備"
  | "廣告"
  | "交通"
  | "其他"
  | "收入";
type FinanceRecord = {
  id: number;
  date: string;
  endDate?: string;
  category: FinanceCategory;
  name: string;
  amount: number;
  note: string;
  system?: "booking-income";
  systemMonth?: string;
};
type BookingDraft = {
  mode: "new" | "edit";
  editId?: number;
  customerId?: number;
  customerSearch: string;
  inlineNew: boolean;
  service: string;
  addons: string[];
  coupons: string[];
  paid: number;
  color?: string;
  fields: Record<string, string>;
};
const HOLIDAYS: Record<string, string> = {
  "2026-01-01": "元旦",
  "2026-02-14": "春節假期",
  "2026-02-15": "春節假期",
  "2026-02-16": "春節假期",
  "2026-02-17": "春節",
  "2026-02-18": "初二",
  "2026-02-19": "初三",
  "2026-02-20": "春節假期",
  "2026-02-21": "春節假期",
  "2026-02-22": "春節假期",
  "2026-02-27": "和平紀念日補假",
  "2026-02-28": "和平紀念日",
  "2026-04-03": "兒童節補假",
  "2026-04-04": "兒童節",
  "2026-04-05": "清明節",
  "2026-04-06": "清明節補假",
  "2026-05-01": "勞動節",
  "2026-06-19": "端午節",
  "2026-09-25": "中秋節",
  "2026-09-28": "教師節",
  "2026-10-09": "國慶日補假",
  "2026-10-10": "國慶日",
  "2026-10-24": "光復節連假",
  "2026-10-25": "臺灣光復節",
  "2026-10-26": "光復節補假",
  "2026-12-25": "行憲紀念日",
  "2027-01-01": "元旦",
  "2027-02-04": "春節假期",
  "2027-02-05": "除夕",
  "2027-02-06": "春節",
  "2027-02-07": "初二",
  "2027-02-08": "初三",
  "2027-02-09": "春節補假",
  "2027-02-10": "春節補假",
  "2027-02-28": "和平紀念日",
  "2027-03-01": "和平紀念日補假",
  "2027-04-04": "兒童節",
  "2027-04-05": "清明節",
  "2027-04-06": "兒童節補假",
  "2027-04-30": "勞動節補假",
  "2027-05-01": "勞動節",
  "2027-06-09": "端午節",
  "2027-09-15": "中秋節",
  "2027-09-28": "教師節",
  "2027-10-10": "國慶日",
  "2027-10-11": "國慶日補假",
  "2027-10-25": "臺灣光復節",
  "2027-12-24": "行憲紀念日補假",
  "2027-12-25": "行憲紀念日",
  "2027-12-31": "元旦補假",
};
const lunarDayName = (day: number) => {
  const digits = [
    "",
    "一",
    "二",
    "三",
    "四",
    "五",
    "六",
    "七",
    "八",
    "九",
    "十",
  ];
  if (day <= 10) return `初${digits[day]}`;
  if (day < 20) return `十${digits[day - 10]}`;
  if (day === 20) return "二十";
  if (day < 30) return `廿${digits[day - 20]}`;
  return "三十";
};
const lunarParts = (date: string) => {
    try {
      const parts = new Intl.DateTimeFormat("zh-TW-u-ca-chinese", {
          month: "long",
          day: "numeric",
        }).formatToParts(new Date(`${date}T12:00:00`)),
        month = parts.find((p) => p.type === "month")?.value || "",
        day = Number(parts.find((p) => p.type === "day")?.value || 0);
      return { month, day };
    } catch {
      return { month: "", day: 0 };
    }
  },
  lunarText = (date: string) => {
    const { month, day } = lunarParts(date);
    if (!day) return "";
    return day === 1 ? month : lunarDayName(day);
  },
  holidayText = (date: string) => {
    if (HOLIDAYS[date]) return HOLIDAYS[date];
    const fixed: Record<string, string> = {
        "01-01": "元旦",
        "02-28": "和平紀念日",
        "04-04": "兒童節",
        "05-01": "勞動節",
        "09-28": "教師節",
        "10-10": "國慶日",
        "10-25": "臺灣光復節",
        "12-25": "行憲紀念日",
      },
      fixedName = fixed[date.slice(5)];
    if (fixedName) return fixedName;
    const { month, day } = lunarParts(date);
    if (month === "正月" && day === 1) return "春節";
    if (month === "五月" && day === 5) return "端午節";
    if (month === "八月" && day === 15) return "中秋節";
    return "";
  };
const parse = (s: string) => {
    try {
      return JSON.parse(s || "[]") as string[];
    } catch {
      return [];
    }
  },
  parsePrices = (s?: string) => {
    try {
      return JSON.parse(s || "{}") as Record<string, number>;
    } catch {
      return {};
    }
  },
  pad = (n: number) => String(n).padStart(2, "0"),
  iso = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  money = (n: number) => `NT$${n.toLocaleString("zh-TW")}`,
  financeMoney = (n: number) => `$${n.toLocaleString("zh-TW")}`,
  finish = (time: string, duration: number) => {
    const [h, m] = time.split(":").map(Number),
      total = h * 60 + m + duration;
    return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
  },
  dateValue = (s: string) => new Date(`${s}T12:00:00`).getTime(),
  occursOn = (a: A, date: string) =>
    a.personal && a.endDate
      ? date >= a.date && date <= a.endDate
      : a.date === date,
  shiftDate = (date: string, days: number) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + days);
    return iso(d);
  },
  weeklyRangeMiddle = (a: { date: string; endDate?: string }, date: string) => {
    const weekday = new Date(`${date}T12:00:00`).getDay(),
      weekStart = shiftDate(date, -weekday),
      weekEnd = shiftDate(date, 6 - weekday),
      segmentStart = a.date > weekStart ? a.date : weekStart,
      segmentEnd =
        (a.endDate || a.date) < weekEnd ? a.endDate || a.date : weekEnd;
    return shiftDate(
      segmentStart,
      Math.floor((dateValue(segmentEnd) - dateValue(segmentStart)) / 172800000),
    );
  };
type LocalData = {
  customers: C[];
  appointments: A[];
  serviceCatalog: Item[];
  addonCatalog: Item[];
  couponCatalog: Coupon[];
  financeRecords: FinanceRecord[];
};
const STORE = "wife-booking-private-v1",
  BOOKING_DRAFT = "wife-booking-draft-v1",
  DRIVE_ROLE_KEY = "clarte-drive-role",
  DRIVE_FILE_KEY = "clarte-drive-file-id",
  DRIVE_FOLDER_KEY = "clarte-drive-folder-id",
  servicesSeed = [
    ["輕耳靜密＋耳燭舒淨", 65],
    ["輕耳靜密＋霧潤亮眼", 80],
    ["輕耳靜密＋臉部撥筋SPA", 85],
    ["輕耳靜密＋肩頸舒揉SPA", 90],
    ["輕耳靜密＋臉部暖石SPA", 100],
    ["療癒全項目", 130],
  ],
  addonsSeed = [
    ["耳部撥筋 SPA", 15],
    ["霧化舒眼", 15],
    ["臉部去角質潤膚 SPA", 20],
    ["頭部深層舒壓", 20],
    ["手／臂舒壓按摩", 20],
    ["肩頸舒揉 SPA", 50],
  ],
  couponsSeed = [
    ["首次預約即享", 50],
    ["IG／社群打卡即享", 50],
    ["兩人同行即享", 100],
    ["介紹好友預約即享", 100],
  ];
const freshData = (): LocalData => ({
  customers: [],
  appointments: [],
  serviceCatalog: servicesSeed.map(([name, duration], i) => ({
    id: i + 1,
    name: String(name),
    duration: Number(duration),
    price: 0,
    active: 1,
  })),
  addonCatalog: addonsSeed.map(([name, duration], i) => ({
    id: i + 1,
    name: String(name),
    duration: Number(duration),
    price: 0,
    active: 1,
  })),
  couponCatalog: couponsSeed.map(([name, discount], i) => ({
    id: i + 1,
    name: String(name),
    discount: Number(discount),
    active: 1,
  })),
  financeRecords: [],
});
const FINANCE_CATEGORIES: {
  name: FinanceCategory;
  color: string;
  icon: "house" | "receipt" | "bottle" | "chair" | "megaphone" | "bus" | "tag" | "pig";
  income?: boolean;
}[] = [
  { name: "房租", color: "#a9cf16", icon: "house" },
  { name: "費用", color: "#C27FA8", icon: "receipt" },
  { name: "耗材", color: "#f58f94", icon: "bottle" },
  { name: "設備", color: "#b79b87", icon: "chair" },
  { name: "廣告", color: "#e9573f", icon: "megaphone" },
  { name: "交通", color: "#27a9e8", icon: "bus" },
  { name: "其他", color: "#8f969c", icon: "tag" },
  { name: "收入", color: "#e7b817", icon: "pig", income: true },
];
const financeMeta = (category: FinanceCategory) =>
  FINANCE_CATEGORIES.find((item) => item.name === category) ||
  FINANCE_CATEGORIES[6];
const compareFinanceRecords = (a: FinanceRecord, b: FinanceRecord) =>
  Number(a.category !== "廣告") - Number(b.category !== "廣告") ||
  a.date.localeCompare(b.date) ||
  a.id - b.id;

function syncMonthlyBookingIncome(d: LocalData) {
  const existing = new Map(
      d.financeRecords
        .filter((record) => record.system === "booking-income")
        .map((record) => [record.systemMonth || record.date.slice(0, 7), record]),
    ),
    totals = new Map<string, number>();
  let nextRecordId = Math.max(0, ...d.financeRecords.map((record) => record.id)) + 1;

  for (const appointment of d.appointments) {
    if (
      appointment.personal ||
      appointment.status === "cancelled" ||
      appointment.service === "0－取消" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(appointment.date)
    )
      continue;
    const monthKey = appointment.date.slice(0, 7);
    totals.set(monthKey, (totals.get(monthKey) || 0) + Math.max(0, appointment.price || 0));
  }

  d.financeRecords = d.financeRecords.filter(
    (record) => record.system !== "booking-income",
  );
  for (const [monthKey, amount] of Array.from(totals.entries()).sort()) {
    if (amount <= 0) continue;
    const [year, monthNumber] = monthKey.split("-").map(Number),
      monthEnd = `${monthKey}-${pad(new Date(year, monthNumber, 0).getDate())}`,
      previous = existing.get(monthKey);
    d.financeRecords.push({
      id: previous?.id ?? nextRecordId++,
      date: monthEnd,
      endDate: monthEnd,
      category: "收入",
      name: "采耳收入",
      amount,
      note: "系統依本月預約實收金額自動更新",
      system: "booking-income",
      systemMonth: monthKey,
    });
  }
}
function FinanceIcon({
  category,
  className = "",
}: {
  category: FinanceCategory;
  className?: string;
}) {
  const icon = financeMeta(category).icon;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon === "house" && (
        <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>
      )}
      {icon === "receipt" && (
        <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>
      )}
      {icon === "bottle" && (
        <><path d="M9 3h6v4l2 2v11H7V9l2-2V3Z" /><path d="M9 6h6M7 12h10" /><path d="M11 15h2M12 14v2" /></>
      )}
      {icon === "chair" && (
        <><path d="M7 11V6a5 5 0 0 1 10 0v5" /><path d="M5 11h14a2 2 0 0 1 2 2v5H3v-5a2 2 0 0 1 2-2Z" /><path d="M6 18v3M18 18v3" /></>
      )}
      {icon === "megaphone" && (
        <><path d="m3 11 14-6v14L3 13v-2Z" /><path d="M11 16v4H7l-2-6" /><path d="M21 9v6" /></>
      )}
      {icon === "bus" && (
        <><rect x="5" y="3" width="14" height="16" rx="3" /><path d="M7 8h10M7 14h10" /><circle cx="8" cy="17" r="1" /><circle cx="16" cy="17" r="1" /><path d="M7 21v-2M17 21v-2" /></>
      )}
      {icon === "tag" && (
        <><path d="M20 13 11 22l-9-9V4h9l9 9Z" /><circle cx="7" cy="9" r="1.4" /></>
      )}
      {icon === "pig" && (
        <><path d="M5 10a7 6 0 0 1 13-2h3v5h-2a7 6 0 0 1-2 3v3h-3v-2H9v2H6v-3a6 6 0 0 1-1-6Z" /><path d="M8 7 6 4c3-.5 5 0 6 2" /><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" /></>
      )}
    </svg>
  );
}
const TIMETREE_COLORS = [
  { name: "翡翠綠", value: "#35C99A" },
  { name: "現代青", value: "#48C2C8" },
  { name: "天空藍", value: "#4AAFE8" },
  { name: "柔棕色", value: "#A4948D" },
  { name: "午夜黑", value: "#222222" },
  { name: "蘋果紅", value: "#EF3E4A" },
  { name: "法式玫瑰", value: "#EC4F87" },
  { name: "珊瑚粉", value: "#FF7975" },
  { name: "亮橘色", value: "#FFC233" },
  { name: "柔紫色", value: "#A684D8" },
];
const readLocal = (): LocalData => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "null");
      if (!saved) return freshData();
      const seed = freshData();
      return {
        customers: Array.isArray(saved.customers) ? saved.customers : [],
        appointments: Array.isArray(saved.appointments) ? saved.appointments : [],
        serviceCatalog: Array.isArray(saved.serviceCatalog)
          ? saved.serviceCatalog
          : seed.serviceCatalog,
        addonCatalog: Array.isArray(saved.addonCatalog)
          ? saved.addonCatalog
          : seed.addonCatalog,
        couponCatalog: Array.isArray(saved.couponCatalog)
          ? saved.couponCatalog
          : seed.couponCatalog,
        financeRecords: Array.isArray(saved.financeRecords)
          ? saved.financeRecords.map((record: FinanceRecord & { category: string }) => ({
              ...record,
              category: String(record.category) === "采耳" ? "耗材" : record.category,
            })) as FinanceRecord[]
          : [],
      };
    } catch {
      return freshData();
    }
  },
  writeLocal = (d: LocalData) => {
    if (localStorage.getItem(DRIVE_ROLE_KEY) === "viewer") return;
    syncMonthlyBookingIncome(d);
    localStorage.setItem(STORE, JSON.stringify(d));
    window.dispatchEvent(new Event("clarte-data-change"));
  },
  nextId = (a: { id: number }[]) => Math.max(0, ...a.map((x) => x.id)) + 1;
const CANCEL_SERVICE = "0－取消",
  isFinishedVisit = (a: A) =>
    !a.personal && a.status !== "cancelled" && a.service !== CANCEL_SERVICE;
export default function Home() {
  const [tab, setTab] = useState<"cal" | "people" | "finance" | "services">("cal"),
    [month, setMonth] = useState(new Date()),
    [day, setDay] = useState(iso(new Date())),
    [customers, setCustomers] = useState<C[]>([]),
    [appointments, setAppointments] = useState<A[]>([]),
    [services, setServices] = useState<Item[]>([]),
    [addons, setAddons] = useState<Item[]>([]),
    [couponItems, setCouponItems] = useState<Coupon[]>([]),
    [serviceCatalog, setServiceCatalog] = useState<Item[]>([]),
    [addonCatalog, setAddonCatalog] = useState<Item[]>([]),
    [couponCatalog, setCouponCatalog] = useState<Coupon[]>([]),
    [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]),
    [modal, setModal] = useState<"" | "new" | "customer">(""),
    [profile, setProfile] = useState<C | null>(null),
    [editProfile, setEditProfile] = useState(false),
    [editAppt, setEditAppt] = useState<A | null>(null),
    [query, setQuery] = useState("");
  const [customerSearch, setCustomerSearch] = useState(""),
    [chosenCustomer, setChosenCustomer] = useState<C | null>(null),
    [inlineNew, setInlineNew] = useState(false),
    [service, setService] = useState(""),
    [chosenAddons, setChosenAddons] = useState<string[]>([]),
    [chosenCoupons, setChosenCoupons] = useState<string[]>([]),
    [paid, setPaid] = useState(0),
    [bookingColor, setBookingColor] = useState("#4AAFE8"),
    [calendarView, setCalendarView] = useState<"month" | "finance">("month"),
    [transfer, setTransfer] = useState<{ id: number; date: string } | null>(
      null,
    ),
    [financeTransfer, setFinanceTransfer] = useState<{
      id: number;
      date: string;
    } | null>(null),
    [reportMonth, setReportMonth] = useState(() => new Date()),
    [financeDetailCategory, setFinanceDetailCategory] =
      useState<FinanceCategory | null>(null),
    [showWedding, setShowWedding] = useState(false),
    [dragPreview, setDragPreview] = useState<{
      id: number;
      name: string;
      color: string;
      x: number;
      y: number;
      targetDate: string;
    } | null>(null),
    [eventEditor, setEventEditor] = useState<A | "new" | null>(null),
    [eventAllDay, setEventAllDay] = useState(false),
    [eventColor, setEventColor] = useState("#4AAFE8"),
    [showHolidays, setShowHolidays] = useState(true),
    [showLunar, setShowLunar] = useState(true),
    [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null),
    [financeEditor, setFinanceEditor] = useState<FinanceRecord | "new" | null>(null),
    [financeCategory, setFinanceCategory] = useState<FinanceCategory>("房租"),
    [financeName, setFinanceName] = useState(""),
    [financeAmount, setFinanceAmount] = useState(""),
    [financeNote, setFinanceNote] = useState(""),
    [financeDate, setFinanceDate] = useState(day),
    [financeEndDate, setFinanceEndDate] = useState(day),
    [dayDetailOpen, setDayDetailOpen] = useState(false),
    [dayDetailDragging, setDayDetailDragging] = useState(false),
    [dayDetailPull, setDayDetailPull] = useState(0),
    [dayDetailTop, setDayDetailTop] = useState(170),
    [driveConnection, setDriveConnection] = useState<DriveConnection | null>(null),
    [driveRole, setDriveRole] = useState<DriveRole | null>(null),
    [driveStatus, setDriveStatus] = useState("尚未連接 Google Drive"),
    [driveBusy, setDriveBusy] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    financePressTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    dragging = useRef(false),
    pressOrigin = useRef({ x: 0, y: 0 }),
    dragId = useRef<number | null>(null),
    financeDragId = useRef<number | null>(null),
    financeSuppressClick = useRef(false),
    dragTargetDate = useRef(""),
    edgeScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null),
    edgeScrollDirection = useRef(0),
    scrollFrame = useRef<number | null>(null),
    scrollDirection = useRef(0),
    calendarViewport = useRef<HTMLDivElement | null>(null),
    calendarHeaderLabel = useRef<HTMLElement | null>(null),
    calendarScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    reportSwipeStart = useRef({ x: 0, y: 0 }),
    financeDetailSwipeStart = useRef({ x: 0, y: 0 }),
    calendarRangeStart = useRef(
      new Date(new Date().getFullYear(), new Date().getMonth() - 24, 1),
    ),
    customerPress = useRef<ReturnType<typeof setTimeout> | null>(null),
    customerDidLongPress = useRef(false),
    logoTaps = useRef({ count: 0, last: 0 }),
    driveSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    driveSilentBusy = useRef(false),
    driveConnectionRef = useRef<DriveConnection | null>(null),
    lastViewerRefreshAt = useRef(0),
    dayDetailPullStart = useRef<number | null>(null),
    dayDetailPullAmount = useRef(0),
    lastTappedDay = useRef(""),
    skipPriceSync = useRef(true);
  const calendarMonths = useMemo(
    () =>
      Array.from(
        { length: 73 },
        (_, i) =>
          new Date(
            calendarRangeStart.current.getFullYear(),
            calendarRangeStart.current.getMonth() + i,
            1,
          ),
      ),
    [],
  );
  const calendarMonthIndex = (target: Date) =>
    (target.getFullYear() - calendarRangeStart.current.getFullYear()) * 12 +
    target.getMonth() -
    calendarRangeStart.current.getMonth();
  const load = async () => {
    const d = readLocal();
    syncMonthlyBookingIncome(d);
    localStorage.setItem(STORE, JSON.stringify(d));
    setCustomers([...d.customers]);
    setAppointments([...d.appointments]);
    setServiceCatalog([...d.serviceCatalog]);
    setAddonCatalog([...d.addonCatalog]);
    setCouponCatalog([...d.couponCatalog]);
    setFinanceRecords([...(d.financeRecords || [])]);
    setServices([...d.serviceCatalog]);
    setAddons([...d.addonCatalog]);
    setCouponItems([...d.couponCatalog]);
    if (d.serviceCatalog[0]) setService((v) => v || d.serviceCatalog[0].name);
  };
  const applyDriveData = async (value: unknown) => {
    const d = value as Partial<LocalData>;
    if (
      !Array.isArray(d.customers) ||
      !Array.isArray(d.appointments) ||
      !Array.isArray(d.serviceCatalog) ||
      !Array.isArray(d.addonCatalog) ||
      !Array.isArray(d.couponCatalog)
    )
      throw new Error("Google Drive 備份格式不正確");
    const normalized: LocalData = {
      customers: d.customers,
      appointments: d.appointments,
      serviceCatalog: d.serviceCatalog,
      addonCatalog: d.addonCatalog,
      couponCatalog: d.couponCatalog,
      financeRecords: Array.isArray(d.financeRecords) ? d.financeRecords : [],
    };
    syncMonthlyBookingIncome(normalized);
    localStorage.setItem(STORE, JSON.stringify(normalized));
    await load();
  };
  async function connectDrive() {
    if (driveBusy) return;
    setDriveBusy(true);
    setDriveStatus("正在連接 Google Drive…");
    try {
      const connection = await connectGoogleDrive();
      if (connection.role === "owner") {
        localStorage.setItem(DRIVE_ROLE_KEY, "owner");
        setDriveRole("owner");
        const localData = readLocal();
        const hasLocalRecords =
          localData.customers.length > 0 ||
          localData.appointments.length > 0 ||
          (localData.financeRecords || []).length > 0;
        if (!hasLocalRecords) {
          const existing = await getExistingOwnerBackup(connection.token);
          if (existing) await applyDriveData(existing.data);
        }
        const setup = await prepareOwnerBackup(connection.token, readLocal());
        localStorage.setItem(DRIVE_FILE_KEY, setup.fileId);
        localStorage.setItem(DRIVE_FOLDER_KEY, setup.folderId);
        driveConnectionRef.current = connection;
        setDriveConnection(connection);
        setDriveStatus("已連接 · 自動備份已開啟");
      } else {
        let fileId = localStorage.getItem(DRIVE_FILE_KEY) || "",
          data: unknown;
        if (fileId) {
          try {
            data = await downloadBackup(connection.token, fileId);
          } catch {
            fileId = "";
          }
        }
        if (!fileId) {
          fileId = await pickBackupFile(connection.token);
          data = await downloadBackup(connection.token, fileId);
        }
        await applyDriveData(data);
        localStorage.setItem(DRIVE_ROLE_KEY, "viewer");
        setDriveRole("viewer");
        localStorage.setItem(DRIVE_FILE_KEY, fileId);
        driveConnectionRef.current = connection;
        setDriveConnection(connection);
        setDriveStatus("已連接 · 唯讀查看模式");
      }
    } catch (error) {
      setDriveStatus(error instanceof Error ? error.message : "Google Drive 連線失敗");
    } finally {
      setDriveBusy(false);
    }
  }
  useEffect(() => {
    load();
    const refresh = () => load(),
      visible = () => {
        if (document.visibilityState === "visible") load();
      };
    window.addEventListener("clarte-data-change", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("clarte-data-change", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    if (!driveConnection || driveConnection.role !== "owner") return;
    const fileId = localStorage.getItem(DRIVE_FILE_KEY),
      folderId = localStorage.getItem(DRIVE_FOLDER_KEY);
    if (!fileId || !folderId) return;
    const scheduleUpload = () => {
      if (driveSyncTimer.current) clearTimeout(driveSyncTimer.current);
      driveSyncTimer.current = setTimeout(async () => {
        try {
          setDriveStatus("正在自動備份…");
          let connection = driveConnectionRef.current || driveConnection;
          if (connection.expiresAt <= Date.now() + 120000) {
            connection = await reconnectGoogleDriveSilently("owner");
            if (connection.role !== "owner")
              throw new Error("請使用主要帳號連接");
            driveConnectionRef.current = connection;
            setDriveConnection(connection);
          }
          await uploadOwnerBackup(
            connection.token,
            fileId,
            folderId,
            readLocal(),
          );
          setDriveStatus("已連接 · 剛剛完成備份");
        } catch {
          setDriveStatus("Google 授權已到期，請重新連接以繼續備份");
        }
      }, 4000);
    };
    window.addEventListener("clarte-data-change", scheduleUpload);
    return () => {
      window.removeEventListener("clarte-data-change", scheduleUpload);
      if (driveSyncTimer.current) clearTimeout(driveSyncTimer.current);
    };
  }, [driveConnection]);
  useEffect(() => {
    if (driveRole !== "owner") return;
    let disposed = false;
    const restoreOwnerDrive = async () => {
      const fileId = localStorage.getItem(DRIVE_FILE_KEY),
        folderId = localStorage.getItem(DRIVE_FOLDER_KEY),
        current = driveConnectionRef.current;
      if (
        !fileId ||
        !folderId ||
        driveSilentBusy.current ||
        (current && current.expiresAt > Date.now() + 120000)
      )
        return;
      driveSilentBusy.current = true;
      try {
        if (!disposed) setDriveStatus("正在自動恢復 Google Drive 連線…");
        const connection = await reconnectGoogleDriveSilently("owner");
        if (connection.role !== "owner")
          throw new Error("請使用主要帳號連接");
        driveConnectionRef.current = connection;
        if (!disposed) setDriveConnection(connection);
        await uploadOwnerBackup(connection.token, fileId, folderId, readLocal());
        if (!disposed) setDriveStatus("已連接 · 自動備份已恢復");
      } catch {
        if (!disposed)
          setDriveStatus("無法自動續期，請按一次連接 Google Drive");
      } finally {
        driveSilentBusy.current = false;
      }
    };
    void restoreOwnerDrive();
    const timer = window.setInterval(restoreOwnerDrive, 60000),
      onFocus = () => void restoreOwnerDrive(),
      onVisible = () => {
        if (document.visibilityState === "visible") void restoreOwnerDrive();
      };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [driveRole]);
  useEffect(() => {
    if (driveRole !== "viewer") return;
    let disposed = false;
    const refreshFromDrive = async () => {
      const fileId = localStorage.getItem(DRIVE_FILE_KEY);
      const now = Date.now();
      if (
        !fileId ||
        driveSilentBusy.current ||
        now - lastViewerRefreshAt.current < 10000
      )
        return;
      driveSilentBusy.current = true;
      lastViewerRefreshAt.current = now;
      try {
        let connection = driveConnectionRef.current;
        if (!connection || connection.expiresAt <= Date.now() + 120000) {
          setDriveStatus("正在自動連接 Google Drive…");
          connection = await reconnectGoogleDriveSilently("viewer");
          if (connection.role !== "viewer")
            throw new Error("請使用唯讀帳號連接");
          driveConnectionRef.current = connection;
          if (!disposed) setDriveConnection(connection);
        }
        const data = await downloadBackup(connection.token, fileId);
        await applyDriveData(data);
        if (!disposed) setDriveStatus("已連接 · 資料已自動更新");
      } catch {
        if (!disposed)
          setDriveStatus("無法自動續期，請按一次連接 Google Drive");
      } finally {
        driveSilentBusy.current = false;
      }
    };
    void refreshFromDrive();
    const timer = window.setInterval(refreshFromDrive, 60000),
      onFocus = () => void refreshFromDrive(),
      onVisible = () => {
        if (document.visibilityState === "visible") void refreshFromDrive();
      };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [driveRole]);
  useEffect(() => {
    const holidaySetting = localStorage.getItem("clarte-show-holidays"),
      lunarSetting = localStorage.getItem("clarte-show-lunar"),
      storedDriveRole = localStorage.getItem(DRIVE_ROLE_KEY);
    if (holidaySetting !== null) setShowHolidays(holidaySetting === "true");
    if (lunarSetting !== null) setShowLunar(lunarSetting === "true");
    if (storedDriveRole === "owner" || storedDriveRole === "viewer") {
      setDriveRole(storedDriveRole);
      setDriveStatus(
        storedDriveRole === "viewer"
          ? "正在自動取得最新資料…"
          : "正在自動恢復 Google Drive 連線…",
      );
    }
  }, []);
  useLayoutEffect(() => {
    const viewport = calendarViewport.current;
    if (viewport) {
      const index = calendarMonthIndex(month);
      if (index >= 0 && index < calendarMonths.length)
        viewport.scrollLeft = index * viewport.clientWidth;
    }
    if (calendarHeaderLabel.current)
      calendarHeaderLabel.current.textContent = `${month.getFullYear()}年 ${month.getMonth() + 1}月`;
  }, [calendarView, tab]);
  useLayoutEffect(() => {
    if (tab !== "cal") return;
    const viewport = calendarViewport.current;
    viewport
      ?.querySelectorAll(".grid button.on")
      .forEach((button) => button.classList.remove("on"));
    viewport
      ?.querySelectorAll<HTMLElement>(`[data-date="${day}"]`)
      .forEach((button) => button.classList.add("on"));
  }, [day, tab, calendarView]);
  useEffect(() => {
    if (!eventEditor) return;
    setEventColor(
      eventEditor === "new" ? "#4AAFE8" : eventEditor.color || "#4AAFE8",
    );
  }, [eventEditor]);
  useEffect(() => {
    const holdDrag = (e: TouchEvent) => {
      if (dragging.current) e.preventDefault();
    };
    document.addEventListener("touchmove", holdDrag, { passive: false });
    return () => document.removeEventListener("touchmove", holdDrag);
  }, []);
  useEffect(() => {
    try {
      const draft = JSON.parse(
        localStorage.getItem(BOOKING_DRAFT) || "null",
      ) as BookingDraft | null;
      if (!draft) return;
      const d = readLocal(),
        customer = d.customers.find((c) => c.id === draft.customerId);
      setBookingDraft(draft);
      setCustomerSearch(draft.customerSearch || customer?.name || "");
      setChosenCustomer(customer || null);
      setInlineNew(!!draft.inlineNew);
      setService(draft.service || d.serviceCatalog[0]?.name || "");
      setChosenAddons(draft.addons || []);
      setChosenCoupons(draft.coupons || []);
      setPaid(draft.paid || 0);
      setBookingColor(draft.color || draft.fields?.color || "#4AAFE8");
      if (draft.mode === "edit") {
        const a = d.appointments.find((a) => a.id === draft.editId);
        if (a) {
          skipPriceSync.current = true;
          setEditAppt(a);
        }
      } else setModal("new");
    } catch {
      localStorage.removeItem(BOOKING_DRAFT);
    }
  }, []);
  const total = useMemo(
    () =>
      Math.max(
        0,
        (services.find((x) => x.name === service)?.price || 0) +
          addons
            .filter((x) => chosenAddons.includes(x.name))
            .reduce((n, x) => n + x.price, 0) -
          couponItems
            .filter((x) => chosenCoupons.includes(x.name))
            .reduce((n, x) => n + x.discount, 0),
      ),
    [service, chosenAddons, chosenCoupons, services, addons, couponItems],
  );
  const duration = useMemo(
    () =>
      (services.find((x) => x.name === service)?.duration || 0) +
      addons
        .filter((x) => chosenAddons.includes(x.name))
        .reduce((n, x) => n + x.duration, 0),
    [service, chosenAddons, services, addons],
  );
  useEffect(() => {
    if (!editAppt) return;
    if (skipPriceSync.current) {
      skipPriceSync.current = false;
      return;
    }
    setPaid(total);
  }, [total, service, chosenAddons, chosenCoupons, editAppt]);
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(".booking-draft-form");
    if (form && (modal === "new" || editAppt))
      saveBookingDraft(form, editAppt ? "edit" : "new");
  }, [
    service,
    chosenAddons,
    chosenCoupons,
    paid,
    bookingColor,
    chosenCustomer,
    customerSearch,
    inlineNew,
    modal,
    editAppt,
  ]);
  const history = useMemo(
    () =>
      Object.fromEntries(
        customers.map((c) => [
          c.id,
          appointments.filter(
            (a) => a.customerId === c.id && isFinishedVisit(a),
          ),
        ]),
      ),
    [customers, appointments],
  );
  const monthlyVisits = useMemo(
    () =>
      appointments.filter(
        (a) =>
          isFinishedVisit(a) &&
          a.date.startsWith(
            `${reportMonth.getFullYear()}-${pad(reportMonth.getMonth() + 1)}`,
          ),
      ),
    [appointments, reportMonth],
  );
  const monthlyCancellations = useMemo(
    () =>
      appointments.filter(
        (a) =>
          (a.status === "cancelled" || a.service === CANCEL_SERVICE) &&
          a.date.startsWith(
            `${reportMonth.getFullYear()}-${pad(reportMonth.getMonth() + 1)}`,
          ),
      ),
    [appointments, reportMonth],
  );
  const monthlyNewCustomers = useMemo(
    () =>
      new Set(
        monthlyVisits
          .filter((a) => a.label === "新顧客")
          .map((a) => a.customerId),
      ).size,
    [monthlyVisits],
  );
  const monthlyBreakdown = useMemo(() => {
    type Row = { count: number; amount: number };
    const main: Record<string, Row> = {},
      extra: Record<string, Row> = {},
      discount: Record<string, Row> = {};
    for (const a of monthlyVisits) {
      const serviceAmount =
        a.servicePrice ??
        serviceCatalog.find((x) => x.name === a.service)?.price ??
        0;
      main[a.service] ||= { count: 0, amount: 0 };
      main[a.service].count++;
      main[a.service].amount += serviceAmount;
      const addonSnapshot = parsePrices(a.addonPrices);
      for (const name of parse(a.addons)) {
        extra[name] ||= { count: 0, amount: 0 };
        extra[name].count++;
        extra[name].amount +=
          addonSnapshot[name] ??
          addonCatalog.find((x) => x.name === name)?.price ??
          0;
      }
      const couponSnapshot = parsePrices(a.couponDiscounts);
      for (const name of parse(a.coupons)) {
        discount[name] ||= { count: 0, amount: 0 };
        discount[name].count++;
        discount[name].amount +=
          couponSnapshot[name] ??
          couponCatalog.find((x) => x.name === name)?.discount ??
          0;
      }
    }
    const rows = (r: Record<string, Row>) =>
      Object.entries(r)
        .map(([name, v]) => ({ name, ...v }))
        .sort(
          (a, b) =>
            b.count - a.count || a.name.localeCompare(b.name, "zh-Hant"),
        );
    return { main: rows(main), addons: rows(extra), coupons: rows(discount) };
  }, [monthlyVisits, serviceCatalog, addonCatalog, couponCatalog]);
  const selectedFinanceRecords = useMemo(
      () =>
        financeRecords
          .filter(
            (record) =>
              record.date <= day && (record.endDate || record.date) >= day,
          )
          .sort(compareFinanceRecords),
      [financeRecords, day],
    ),
    financeMonthRecords = useMemo(
      () =>
        financeRecords.filter((record) =>
          record.date.startsWith(
            `${month.getFullYear()}-${pad(month.getMonth() + 1)}`,
          ),
        ),
      [financeRecords, month],
    ),
    dailyIncome = selectedFinanceRecords
      .filter((record) => record.date === day)
      .filter((record) => record.category === "收入")
      .reduce((sum, record) => sum + record.amount, 0),
    dailyExpense = selectedFinanceRecords
      .filter((record) => record.date === day)
      .filter((record) => record.category !== "收入")
      .reduce((sum, record) => sum + record.amount, 0),
    monthlyFinanceIncome = financeMonthRecords
      .filter((record) => record.category === "收入")
      .reduce((sum, record) => sum + record.amount, 0),
    monthlyFinanceExpense = financeMonthRecords
      .filter((record) => record.category !== "收入")
      .reduce((sum, record) => sum + record.amount, 0),
    financeSuggestions = useMemo(
      () =>
        Array.from(
          new Set(
            financeRecords
              .filter((record) => record.category === financeCategory)
              .map((record) => record.name.trim())
              .filter(Boolean),
          ),
        ).slice(-12).reverse(),
      [financeRecords, financeCategory],
    );
  const financeOverviewRecords = useMemo(
      () =>
        financeRecords
          .filter((record) =>
            record.date.startsWith(
              `${reportMonth.getFullYear()}-${pad(reportMonth.getMonth() + 1)}`,
            ),
          )
          .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id),
      [financeRecords, reportMonth],
    ),
    overviewIncome = financeOverviewRecords
      .filter((record) => record.category === "收入")
      .reduce((sum, record) => sum + record.amount, 0),
    overviewExpense = financeOverviewRecords
      .filter((record) => record.category !== "收入")
      .reduce((sum, record) => sum + record.amount, 0),
    overviewProfit = overviewIncome - overviewExpense,
    financeCategoryRows = FINANCE_CATEGORIES.map((meta) => {
      const records = financeOverviewRecords.filter(
          (record) => record.category === meta.name,
        ),
        amount = records.reduce((sum, record) => sum + record.amount, 0),
        basis = meta.name === "收入" ? overviewIncome : overviewExpense;
      return {
        ...meta,
        records,
        count: records.length,
        amount,
        percent: basis ? Math.round((amount / basis) * 100) : 0,
      };
    }),
    visibleFinanceCategoryRows = financeCategoryRows
      .filter((row) => row.count > 0)
      .sort(
        (a, b) =>
          Number(b.name === "收入") - Number(a.name === "收入") ||
          b.amount - a.amount ||
          a.name.localeCompare(b.name, "zh-Hant"),
      ),
    expenseGradient = (() => {
      if (!overviewExpense) return "#eeeeef";
      let cursor = 0;
      const stops: string[] = [];
      for (const row of financeCategoryRows.filter(
        (item) => item.name !== "收入" && item.amount > 0,
      )) {
        const next = cursor + (row.amount / overviewExpense) * 100;
        stops.push(`${row.color} ${cursor}% ${next}%`);
        cursor = next;
      }
      return `conic-gradient(${stops.join(",")})`;
    })(),
    activeFinanceDetail = financeDetailCategory
      ? financeCategoryRows.find((row) => row.name === financeDetailCategory)
      : undefined;
  const first = new Date(month.getFullYear(), month.getMonth(), 1),
    days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    cells = Array(first.getDay())
      .fill(0)
      .concat(Array.from({ length: days }, (_, i) => i + 1));
  useEffect(() => {
    if (!profile || editProfile) return;
    const visits = history[profile.id] || [];
    requestAnimationFrame(() =>
      document
        .querySelectorAll<HTMLElement>(".history.detailed")
        .forEach((el, i) => {
          const a = visits[i];
          if (a && !el.querySelector(".edit-history")) {
            const button = document.createElement("button");
            button.className = "edit-history";
            button.textContent = "編輯紀錄";
            button.onclick = () => openEdit(a);
            el.appendChild(button);
          }
        }),
    );
  }, [profile, editProfile, history]);
  const post = async (body: object, method = "POST") => {
    const p: any = body,
      d = readLocal();
    let result: any = { ok: true };
    if (method === "POST" && p.kind === "customer") {
      result = {
        id: nextId(d.customers),
        name: String(p.name || "").trim(),
        chineseName: String(p.chineseName || ""),
        phone: String(p.phone || ""),
        address: String(p.address || ""),
        occupation: String(p.occupation || ""),
        birthday: String(p.birthday || ""),
        notes: String(p.notes || ""),
        frameColor: "#4AAFE8",
        profileColor: "#ffffff",
      };
      d.customers.push(result);
    } else if (method === "POST" && p.kind === "appointment") {
      const cancelled = p.service === CANCEL_SERVICE,
        s = cancelled
          ? { name: CANCEL_SERVICE, duration: 0, price: 0 }
          : d.serviceCatalog.find((x) => x.name === p.service),
        aa = cancelled
          ? []
          : d.addonCatalog.filter((x) => p.addons?.includes(x.name)),
        cc = cancelled
          ? []
          : d.couponCatalog.filter((x) => p.coupons?.includes(x.name)),
        c = d.customers.find((x) => x.id === +p.customerId);
      if (s && c) {
        const count =
            p.repeat && p.repeat !== "none"
              ? Math.min(24, Math.max(2, +p.repeatCount || 4))
              : 1,
          group = count > 1 ? String(Date.now()) : undefined;
        for (let i = 0; i < count; i++) {
          const when = new Date(`${p.date}T12:00:00`);
          if (p.repeat === "weekly") when.setDate(when.getDate() + i * 7);
          else if (p.repeat === "biweekly")
            when.setDate(when.getDate() + i * 14);
          else if (p.repeat === "monthly") when.setMonth(when.getMonth() + i);
          d.appointments.push({
            id: nextId(d.appointments),
            customerId: c.id,
            customerName: c.name,
            service: s.name,
            servicePrice: s.price,
            addons: JSON.stringify(aa.map((x) => x.name)),
            addonPrices: JSON.stringify(
              Object.fromEntries(aa.map((x) => [x.name, x.price])),
            ),
            coupons: JSON.stringify(cc.map((x) => x.name)),
            couponDiscounts: JSON.stringify(
              Object.fromEntries(cc.map((x) => [x.name, x.discount])),
            ),
            date: iso(when),
            time: String(p.time),
            duration: s.duration + aa.reduce((n, x) => n + x.duration, 0),
            price: cancelled
              ? 0
              : Math.max(
                  0,
                  s.price +
                    aa.reduce((n, x) => n + x.price, 0) -
                    cc.reduce((n, x) => n + x.discount, 0),
                ),
            status: cancelled ? "cancelled" : "upcoming",
            note: String(p.note || ""),
            label: String(p.label || ""),
            color: String(p.color || "#4AAFE8"),
            repeatGroup: group,
          });
        }
      }
    } else if (method === "POST" && p.kind === "newService")
      d.serviceCatalog.push({
        id: nextId(d.serviceCatalog),
        name: String(p.name),
        duration: Math.max(0, +p.duration || 0),
        price: Math.max(0, +p.price || 0),
        active: 1,
      });
    else if (method === "POST" && p.kind === "newAddon")
      d.addonCatalog.push({
        id: nextId(d.addonCatalog),
        name: String(p.name),
        duration: Math.max(0, +p.duration || 0),
        price: Math.max(0, +p.price || 0),
        active: 1,
      });
    else if (method === "POST" && p.kind === "newCoupon")
      d.couponCatalog.push({
        id: nextId(d.couponCatalog),
        name: String(p.name),
        discount: Math.max(0, +p.discount || 0),
        active: 1,
      });
    else if (p.kind === "customer") {
      const x = d.customers.find((x) => x.id === +p.id);
      if (x) {
        Object.assign(x, p, { id: x.id });
        result = x;
        d.appointments
          .filter((a) => a.customerId === x.id)
          .forEach((a) => (a.customerName = x.name));
      }
    } else if (
      p.kind === "service" ||
      p.kind === "addon" ||
      p.kind === "coupon"
    ) {
      const list =
          p.kind === "service"
            ? d.serviceCatalog
            : p.kind === "addon"
              ? d.addonCatalog
              : d.couponCatalog,
        x: any = list.find((x) => x.id === +p.id);
      if (x)
        Object.assign(x, p, {
          active: 1,
          duration:
            p.kind !== "coupon" ? Math.max(0, +p.duration || 0) : x.duration,
        });
    } else if (p.kind === "booking") {
      const a = d.appointments.find((x) => x.id === +p.id),
        cancelled = p.service === CANCEL_SERVICE,
        s = cancelled
          ? { name: CANCEL_SERVICE, duration: 0, price: 0 }
          : d.serviceCatalog.find((x) => x.name === p.service),
        aa = cancelled
          ? []
          : d.addonCatalog.filter((x) => p.addons?.includes(x.name)),
        cc = cancelled
          ? []
          : d.couponCatalog.filter((x) => p.coupons?.includes(x.name));
      if (a && s)
        Object.assign(a, {
          service: s.name,
          servicePrice: s.price,
          addons: JSON.stringify(aa.map((x) => x.name)),
          addonPrices: JSON.stringify(
            Object.fromEntries(aa.map((x) => [x.name, x.price])),
          ),
          coupons: JSON.stringify(cc.map((x) => x.name)),
          couponDiscounts: JSON.stringify(
            Object.fromEntries(cc.map((x) => [x.name, x.discount])),
          ),
          date: String(p.date),
          time: String(p.time),
          duration: s.duration + aa.reduce((n, x) => n + x.duration, 0),
          price: cancelled
            ? 0
            : p.paidPrice === undefined
              ? Math.max(
                  0,
                  s.price +
                    aa.reduce((n, x) => n + x.price, 0) -
                    cc.reduce((n, x) => n + x.discount, 0),
                )
              : Math.max(0, +p.paidPrice),
          status: cancelled ? "cancelled" : "upcoming",
          note: String(p.note || ""),
          label: String(p.label || ""),
          color: String(p.color || a.color || "#4AAFE8"),
        });
    } else {
      const a = d.appointments.find((x) => x.id === +p.id);
      if (a) a.status = p.status;
    }
    writeLocal(d);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  function clearBookingDraft() {
    localStorage.removeItem(BOOKING_DRAFT);
    setBookingDraft(null);
  }
  function closeBookingForm() {
    clearBookingDraft();
    setModal("");
    setEditAppt(null);
  }
  function saveBookingDraft(form: HTMLFormElement, mode: "new" | "edit") {
    const fields = Object.fromEntries(
        Array.from(new FormData(form).entries()).map(([k, v]) => [
          k,
          String(v),
        ]),
      ),
      selectedService = fields.service || service,
      draft: BookingDraft = {
        mode,
        editId: mode === "edit" ? editAppt?.id : undefined,
        customerId: chosenCustomer?.id,
        customerSearch,
        inlineNew,
        service: selectedService,
        addons: chosenAddons,
        coupons: chosenCoupons,
        paid,
        color: bookingColor,
        fields,
      };
    localStorage.setItem(BOOKING_DRAFT, JSON.stringify(draft));
    setBookingDraft(draft);
  }
  function resetBooking() {
    setChosenCustomer(null);
    setCustomerSearch("");
    setInlineNew(false);
    setService(services[0]?.name || "");
    setChosenAddons([]);
    setChosenCoupons([]);
    setBookingColor("#4AAFE8");
  }
  function openNew() {
    clearBookingDraft();
    resetBooking();
    setModal("new");
  }
  function openEdit(a: A) {
    if (driveRole === "viewer") return;
    clearBookingDraft();
    setProfile(null);
    skipPriceSync.current = true;
    setEditAppt(a);
    setService(a.service);
    setChosenAddons(parse(a.addons));
    setChosenCoupons(parse(a.coupons));
    setPaid(a.price);
    setBookingColor(a.color || "#4AAFE8");
  }
  async function createCustomer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const r = await post({
      kind: "customer",
      ...Object.fromEntries(new FormData(e.currentTarget)),
    });
    if (r.ok) {
      const c = await r.json();
      await load();
      if (modal === "new") {
        setChosenCustomer(c);
        setInlineNew(false);
        setCustomerSearch(c.name);
      } else setModal("");
    }
  }
  async function saveBooking(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!chosenCustomer) return;
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const selectedService = String(f.service || service);
    await post({
      kind: "appointment",
      ...f,
      customerId: chosenCustomer.id,
      service: selectedService,
      addons: chosenAddons,
      coupons: chosenCoupons,
    });
    clearBookingDraft();
    setModal("");
    await load();
  }
  async function saveEditBooking(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editAppt) return;
    const fields = Object.fromEntries(new FormData(e.currentTarget)),
      selectedService = String(fields.service || service);
    await post(
      {
        kind: "booking",
        id: editAppt.id,
        ...fields,
        service: selectedService,
        addons: chosenAddons,
        coupons: chosenCoupons,
        paidPrice: paid,
      },
      "PATCH",
    );
    clearBookingDraft();
    setEditAppt(null);
    await load();
  }
  async function savePersonalEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)),
      startDate = String(f.startDate),
      endDate = String(f.endDate),
      allDay = f.allDay === "on",
      start = allDay ? "00:00" : String(f.start),
      end = allDay ? "" : String(f.end);
    if (endDate < startDate) {
      alert("結束日期不能早於開始日期");
      return;
    }
    if (!allDay && (!start || !end)) {
      alert("請填寫開始及結束時間");
      return;
    }
    if (!allDay && startDate === endDate && end <= start) {
      alert("結束時間必須晚於開始時間");
      return;
    }
    const [sh, sm] = start.split(":").map(Number),
      [eh, em] = (end || start).split(":").map(Number),
      d = readLocal(),
      values = {
        customerId: 0,
        customerName: String(f.name).trim(),
        service: "個人行程",
        addons: "[]",
        coupons: "[]",
        date: startDate,
        endDate,
        time: start,
        endTime: end,
        allDay,
        duration: allDay ? 0 : Math.max(1, eh * 60 + em - sh * 60 - sm),
        price: 0,
        status: "upcoming",
        note: String(f.note || ""),
        label: "",
        color: String(f.color || "#4AAFE8"),
        personal: true,
      };
    if (eventEditor === "new")
      d.appointments.push({ id: nextId(d.appointments), ...values });
    else if (eventEditor) {
      const a = d.appointments.find((a) => a.id === eventEditor.id);
      if (a) Object.assign(a, values);
    }
    writeLocal(d);
    setEventEditor(null);
    setEventAllDay(false);
    await load();
  }
  async function updateCustomer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    const r = await post(
      {
        kind: "customer",
        id: profile.id,
        ...Object.fromEntries(new FormData(e.currentTarget)),
      },
      "PATCH",
    );
    if (r.ok) {
      setProfile(await r.json());
      setEditProfile(false);
      await load();
    }
  }
  async function patch(body: object) {
    await post(body, "PATCH");
    await load();
  }
  function stopAutoScroll() {
    scrollDirection.current = 0;
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = null;
  }
  function updateAutoScroll(y: number) {
    scrollDirection.current =
      y < 105 ? -1 : y > window.innerHeight - 115 ? 1 : 0;
    if (scrollDirection.current && scrollFrame.current === null) {
      const step = () => {
        if (!dragging.current || !scrollDirection.current) {
          scrollFrame.current = null;
          return;
        }
        window.scrollBy(0, scrollDirection.current * 10);
        scrollFrame.current = requestAnimationFrame(step);
      };
      scrollFrame.current = requestAnimationFrame(step);
    } else if (!scrollDirection.current) stopAutoScroll();
  }
  function stopEdgeMonthScroll() {
    if (edgeScrollTimer.current) clearInterval(edgeScrollTimer.current);
    edgeScrollTimer.current = null;
    edgeScrollDirection.current = 0;
  }
  function updateEdgeMonthScroll(x: number) {
    const direction = x > window.innerWidth - 32 ? 1 : x < 32 ? -1 : 0;
    if (direction === edgeScrollDirection.current) return;
    stopEdgeMonthScroll();
    if (!direction) return;
    edgeScrollDirection.current = direction;
    scrollCalendarBy(direction);
    edgeScrollTimer.current = setInterval(() => {
      if (!dragging.current) return stopEdgeMonthScroll();
      scrollCalendarBy(edgeScrollDirection.current);
    }, 750);
  }
  function startLongPress(e: React.PointerEvent<HTMLElement>, id: number) {
    if (driveRole === "viewer") return;
    if ((e.target as HTMLElement).closest("button,a,input")) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const x = e.clientX,
      y = e.clientY,
      a = appointments.find((a) => a.id === id);
    pressOrigin.current = { x, y };
    dragId.current = id;
    dragTargetDate.current = "";
    dragging.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      dragging.current = true;
      if (dayDetailOpen) setDayDetailDragging(true);
      document.body.classList.add("booking-dragging");
      if (a)
        setDragPreview({
          id,
          name: a.customerName,
          color: a.color || "#4AAFE8",
          x,
          y,
          targetDate: "",
        });
      navigator.vibrate?.(40);
    }, 450);
  }
  function moveLongPress(e: React.PointerEvent<HTMLElement>) {
    const dx = e.clientX - pressOrigin.current.x,
      dy = e.clientY - pressOrigin.current.y;
    if (!dragging.current && Math.hypot(dx, dy) > 12 && pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (dragging.current) {
      e.preventDefault();
      updateAutoScroll(e.clientY);
      const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>("[data-date]"),
        targetDate = target?.dataset.date || "";
      document
        .querySelector(".grid .drag-target")
        ?.classList.remove("drag-target");
      target?.classList.add("drag-target");
      dragTargetDate.current = targetDate;
      setDragPreview((v) =>
        v ? { ...v, x: e.clientX, y: e.clientY, targetDate } : v,
      );
      updateEdgeMonthScroll(e.clientX);
    }
  }
  function endLongPress(e: React.PointerEvent<HTMLElement>) {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    const id = dragId.current,
      wasDragging = dragging.current;
    if (wasDragging && id) {
      e.preventDefault();
      const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>("[data-date]"),
        date = target?.dataset.date || dragTargetDate.current;
      if (date) setTransfer({ id, date });
    } else if (
      id &&
      Math.abs(e.clientX - pressOrigin.current.x) > 75 &&
      Math.abs(e.clientY - pressOrigin.current.y) < 55
    )
      deleteAppointment(id);
    document
      .querySelector(".grid .drag-target")
      ?.classList.remove("drag-target");
    dragging.current = false;
    stopAutoScroll();
    stopEdgeMonthScroll();
    dragId.current = null;
    dragTargetDate.current = "";
    setDragPreview(null);
    document.body.classList.remove("booking-dragging");
    if (wasDragging) {
      setDayDetailOpen(false);
      setDayDetailDragging(false);
      setDayDetailPull(0);
    }
  }
  function cancelLongPress() {
    const wasDragging = dragging.current;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    document
      .querySelector(".grid .drag-target")
      ?.classList.remove("drag-target");
    dragging.current = false;
    stopAutoScroll();
    stopEdgeMonthScroll();
    dragId.current = null;
    dragTargetDate.current = "";
    setDragPreview(null);
    document.body.classList.remove("booking-dragging");
    if (wasDragging) closeDayDetail();
  }
  function applyTransfer(mode: "move" | "copy") {
    if (!transfer) return;
    const d = readLocal(),
      a = d.appointments.find((x) => x.id === transfer.id);
    if (a) {
      const spanEnd =
        a.personal && a.endDate
          ? shiftDate(
              a.endDate,
              Math.round(
                (dateValue(transfer.date) - dateValue(a.date)) / 86400000,
              ),
            )
          : a.endDate;
      if (mode === "copy")
        d.appointments.push({
          ...a,
          id: nextId(d.appointments),
          date: transfer.date,
          endDate: spanEnd,
          repeatGroup: undefined,
        });
      else {
        a.date = transfer.date;
        if (spanEnd) a.endDate = spanEnd;
      }
      writeLocal(d);
      setDay(transfer.date);
      load();
    }
    setTransfer(null);
  }
  function startFinanceLongPress(
    e: React.PointerEvent<HTMLElement>,
    record: FinanceRecord,
  ) {
    if (driveRole === "viewer") return;
    if (record.system === "booking-income") return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    financeDragId.current = record.id;
    dragTargetDate.current = "";
    financeSuppressClick.current = false;
    dragging.current = false;
    if (financePressTimer.current) clearTimeout(financePressTimer.current);
    financePressTimer.current = setTimeout(() => {
      dragging.current = true;
      if (dayDetailOpen) setDayDetailDragging(true);
      financeSuppressClick.current = true;
      document.body.classList.add("booking-dragging");
      setDragPreview({
        id: record.id,
        name: record.name,
        color: financeMeta(record.category).color,
        x: e.clientX,
        y: e.clientY,
        targetDate: "",
      });
      navigator.vibrate?.(40);
    }, 450);
  }
  function moveFinanceLongPress(e: React.PointerEvent<HTMLElement>) {
    const dx = e.clientX - pressOrigin.current.x,
      dy = e.clientY - pressOrigin.current.y;
    if (
      !dragging.current &&
      Math.hypot(dx, dy) > 12 &&
      financePressTimer.current
    ) {
      clearTimeout(financePressTimer.current);
      financePressTimer.current = null;
    }
    if (!dragging.current) return;
    e.preventDefault();
    updateAutoScroll(e.clientY);
    const target = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>("[data-date]"),
      targetDate = target?.dataset.date || "";
    document.querySelector(".grid .drag-target")?.classList.remove("drag-target");
    target?.classList.add("drag-target");
    dragTargetDate.current = targetDate;
    setDragPreview((value) =>
      value
        ? { ...value, x: e.clientX, y: e.clientY, targetDate }
        : value,
    );
    updateEdgeMonthScroll(e.clientX);
  }
  function finishFinanceDrag(closeDetail = false) {
    document.querySelector(".grid .drag-target")?.classList.remove("drag-target");
    dragging.current = false;
    stopAutoScroll();
    stopEdgeMonthScroll();
    financeDragId.current = null;
    dragTargetDate.current = "";
    setDragPreview(null);
    document.body.classList.remove("booking-dragging");
    if (closeDetail) {
      setDayDetailOpen(false);
      setDayDetailDragging(false);
      setDayDetailPull(0);
    }
  }
  function endFinanceLongPress(e: React.PointerEvent<HTMLElement>) {
    if (financePressTimer.current) clearTimeout(financePressTimer.current);
    financePressTimer.current = null;
    const id = financeDragId.current,
      wasDragging = dragging.current;
    if (wasDragging && id) {
      e.preventDefault();
      const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>("[data-date]"),
        date = target?.dataset.date || dragTargetDate.current;
      if (date) setFinanceTransfer({ id, date });
    }
    finishFinanceDrag(wasDragging);
  }
  function cancelFinanceLongPress() {
    if (financePressTimer.current) clearTimeout(financePressTimer.current);
    financePressTimer.current = null;
    finishFinanceDrag(dragging.current);
  }
  function applyFinanceTransfer(mode: "move" | "copy") {
    if (!financeTransfer) return;
    const d = readLocal(),
      record = d.financeRecords.find((item) => item.id === financeTransfer.id);
    if (record) {
      const durationDays = Math.max(
          0,
          Math.round(
            (dateValue(record.endDate || record.date) - dateValue(record.date)) /
              86400000,
          ),
        ),
        transferredEndDate = shiftDate(financeTransfer.date, durationDays);
      if (mode === "copy")
        d.financeRecords.push({
          ...record,
          id: nextId(d.financeRecords),
          date: financeTransfer.date,
          endDate: transferredEndDate,
        });
      else {
        record.date = financeTransfer.date;
        record.endDate = transferredEndDate;
      }
      writeLocal(d);
      setDay(financeTransfer.date);
      load();
    }
    setFinanceTransfer(null);
  }
  function deleteAppointment(id: number) {
    if (driveRole === "viewer") return;
    if (!confirm("確定要刪除這筆預約嗎？")) return;
    const d = readLocal();
    d.appointments = d.appointments.filter((a) => a.id !== id);
    writeLocal(d);
    load();
  }
  function deleteCustomer(c: C) {
    if (driveRole === "viewer") return;
    if (!confirm(`確定要刪除「${c.name}」及其所有預約紀錄嗎？`)) return;
    const d = readLocal();
    d.customers = d.customers.filter((x) => x.id !== c.id);
    d.appointments = d.appointments.filter((a) => a.customerId !== c.id);
    writeLocal(d);
    setProfile(null);
    load();
  }
  function openNewFinanceRecord() {
    setFinanceEditor("new");
    setFinanceCategory("房租");
    setFinanceName("");
    setFinanceAmount("");
    setFinanceNote("");
    setFinanceDate(day);
    setFinanceEndDate(day);
  }
  function openEditFinanceRecord(record: FinanceRecord) {
    if (driveRole === "viewer") return;
    if (record.system === "booking-income") return;
    setFinanceEditor(record);
    setFinanceCategory(record.category);
    setFinanceName(record.name);
    setFinanceAmount(String(record.amount));
    setFinanceNote(record.note || "");
    setFinanceDate(record.date);
    setFinanceEndDate(record.endDate || record.date);
  }
  function saveFinanceRecord(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = financeName.trim(),
      amount = Math.max(0, Number(financeAmount) || 0);
    if (!name) return alert("請輸入項目名稱");
    if (!amount) return alert("請輸入金額");
    if (financeEndDate < financeDate)
      return alert("結束日期不能早於開始日期");
    const d = readLocal(),
      values = {
        date: financeDate,
        endDate: financeEndDate,
        category: financeCategory,
        name,
        amount,
        note: financeNote.trim(),
      };
    if (financeEditor === "new")
      d.financeRecords.push({ id: nextId(d.financeRecords), ...values });
    else if (financeEditor) {
      const record = d.financeRecords.find((item) => item.id === financeEditor.id);
      if (record) Object.assign(record, values);
    }
    writeLocal(d);
    setDay(financeDate);
    setFinanceEditor(null);
    load();
  }
  function deleteFinanceRecord(record: FinanceRecord) {
    if (record.system === "booking-income") return;
    if (!confirm(`確定要刪除「${record.name}」這筆紀錄嗎？`)) return;
    const d = readLocal();
    d.financeRecords = d.financeRecords.filter((item) => item.id !== record.id);
    writeLocal(d);
    setFinanceEditor(null);
    load();
  }
  function startCustomerPress(c: C) {
    if (driveRole === "viewer") return;
    customerDidLongPress.current = false;
    if (customerPress.current) clearTimeout(customerPress.current);
    customerPress.current = setTimeout(() => {
      customerDidLongPress.current = true;
      navigator.vibrate?.(35);
      deleteCustomer(c);
    }, 650);
  }
  function cancelCustomerPress() {
    if (customerPress.current) clearTimeout(customerPress.current);
    customerPress.current = null;
  }
  function scrollCalendar() {
    const currentViewport = calendarViewport.current;
    if (currentViewport?.clientWidth) {
      const visiblePage = Math.max(
          0,
          Math.min(
            calendarMonths.length - 1,
            Math.round(
              currentViewport.scrollLeft / currentViewport.clientWidth,
            ),
          ),
        ),
        visibleMonth = calendarMonths[visiblePage];
      if (calendarHeaderLabel.current)
        calendarHeaderLabel.current.textContent = `${visibleMonth.getFullYear()}年 ${visibleMonth.getMonth() + 1}月`;
    }
    if (calendarScrollTimer.current) clearTimeout(calendarScrollTimer.current);
    calendarScrollTimer.current = setTimeout(() => {
      const viewport = calendarViewport.current;
      if (!viewport || !viewport.clientWidth) return;
      const page = Math.max(
        0,
        Math.min(
          calendarMonths.length - 1,
          Math.round(viewport.scrollLeft / viewport.clientWidth),
        ),
      );
      const visibleMonth = calendarMonths[page];
      if (
        visibleMonth &&
        (visibleMonth.getFullYear() !== month.getFullYear() ||
          visibleMonth.getMonth() !== month.getMonth())
      )
        setMonth(visibleMonth);
    }, 55);
  }
  function scrollCalendarBy(offset: number) {
    const viewport = calendarViewport.current;
    if (!viewport?.clientWidth) return;
    const currentPage = Math.round(viewport.scrollLeft / viewport.clientWidth),
      nextPage = Math.max(
        0,
        Math.min(calendarMonths.length - 1, currentPage + offset),
      );
    viewport.scrollTo({
      left: nextPage * viewport.clientWidth,
      behavior: "smooth",
    });
  }
  function jumpCalendarMonth(value: string) {
    if (!/^\d{4}-\d{2}$/.test(value)) return;
    const [year, monthNumber] = value.split("-").map(Number),
      target = new Date(year, monthNumber - 1, 1),
      index = calendarMonthIndex(target);
    if (index < 0 || index >= calendarMonths.length) return;
    const currentDay = Number(day.slice(8, 10)) || 1,
      lastDay = new Date(year, monthNumber, 0).getDate(),
      targetDay = new Date(year, monthNumber - 1, Math.min(currentDay, lastDay));
    setMonth(target);
    setDay(iso(targetDay));
    if (calendarHeaderLabel.current)
      calendarHeaderLabel.current.textContent = `${year}年 ${monthNumber}月`;
    const viewport = calendarViewport.current;
    if (viewport?.clientWidth)
      viewport.scrollTo({ left: index * viewport.clientWidth, behavior: "auto" });
  }
  function moveReportMonth(offset: number) {
    setFinanceDetailCategory(null);
    setReportMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }
  function jumpReportMonth(value: string) {
    if (!/^\d{4}-\d{2}$/.test(value)) return;
    const [year, monthNumber] = value.split("-").map(Number);
    setReportMonth(new Date(year, monthNumber - 1, 1));
    setFinanceDetailCategory(null);
  }
  function startReportSwipe(e: React.TouchEvent<HTMLElement>) {
    const touch = e.touches[0];
    reportSwipeStart.current = { x: touch.clientX, y: touch.clientY };
  }
  function endReportSwipe(e: React.TouchEvent<HTMLElement>) {
    const touch = e.changedTouches[0],
      dx = touch.clientX - reportSwipeStart.current.x,
      dy = touch.clientY - reportSwipeStart.current.y;
    if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.25)
      moveReportMonth(dx < 0 ? 1 : -1);
  }
  function startFinanceDetailSwipe(e: React.TouchEvent<HTMLElement>) {
    e.stopPropagation();
    const touch = e.touches[0];
    financeDetailSwipeStart.current = { x: touch.clientX, y: touch.clientY };
  }
  function endFinanceDetailSwipe(e: React.TouchEvent<HTMLElement>) {
    e.stopPropagation();
    const touch = e.changedTouches[0],
      dx = touch.clientX - financeDetailSwipeStart.current.x,
      dy = touch.clientY - financeDetailSwipeStart.current.y;
    if (
      !financeDetailCategory ||
      Math.abs(dx) < 55 ||
      Math.abs(dx) <= Math.abs(dy) * 1.25
    )
      return;
    const currentIndex = visibleFinanceCategoryRows.findIndex(
        (row) => row.name === financeDetailCategory,
      ),
      nextIndex = Math.max(
        0,
        Math.min(
          visibleFinanceCategoryRows.length - 1,
          currentIndex + (dx < 0 ? 1 : -1),
        ),
      );
    if (visibleFinanceCategoryRows[nextIndex])
      setFinanceDetailCategory(visibleFinanceCategoryRows[nextIndex].name);
  }
  function tapLogo() {
    const now = Date.now();
    if (now - logoTaps.current.last > 1200) logoTaps.current.count = 0;
    logoTaps.current.last = now;
    logoTaps.current.count++;
    if (logoTaps.current.count === 3) {
      logoTaps.current.count = 0;
      setShowWedding(true);
    }
  }
  function deleteCatalog(
    kind: "service" | "addon" | "coupon",
    item: { id: number; name: string },
  ) {
    if (!confirm(`確定要刪除「${item.name}」嗎？過去的顧客紀錄仍會保留。`))
      return;
    const d = readLocal();
    if (kind === "service")
      d.serviceCatalog = d.serviceCatalog.filter((x) => x.id !== item.id);
    else if (kind === "addon")
      d.addonCatalog = d.addonCatalog.filter((x) => x.id !== item.id);
    else d.couponCatalog = d.couponCatalog.filter((x) => x.id !== item.id);
    writeLocal(d);
    load();
  }
  function reorderCatalog(
    kind: "service" | "addon" | "coupon",
    id: number,
    direction: -1 | 1,
  ) {
    const d = readLocal(),
      list =
        kind === "service"
          ? d.serviceCatalog
          : kind === "addon"
            ? d.addonCatalog
            : d.couponCatalog,
      index = list.findIndex((x) => x.id === id),
      target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    writeLocal(d);
    load();
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify(readLocal(), null, 2)], {
        type: "application/json",
      }),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `預約資料備份-${iso(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function importBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as LocalData;
      if (
        !Array.isArray(data.customers) ||
        !Array.isArray(data.appointments) ||
        !Array.isArray(data.serviceCatalog)
      )
        throw Error();
      if (confirm("匯入會取代這支手機目前的所有資料。確定要繼續嗎？")) {
        writeLocal({
          ...data,
          addonCatalog: Array.isArray(data.addonCatalog)
            ? data.addonCatalog
            : [],
          couponCatalog: Array.isArray(data.couponCatalog)
            ? data.couponCatalog
            : [],
          financeRecords: Array.isArray(data.financeRecords)
            ? data.financeRecords.map((record: FinanceRecord & { category: string }) => ({
                ...record,
                category: String(record.category) === "采耳" ? "耗材" : record.category,
              })) as FinanceRecord[]
            : [],
        });
        await load();
        alert("資料已成功匯入");
      }
    } catch {
      alert("無法讀取這個備份檔案");
    }
    e.target.value = "";
  }
  const customerFields = (c?: C, fields?: Record<string, string>) => (
    <>
      <label>
        顧客姓名
        <input name="name" required defaultValue={fields?.name ?? c?.name} />
      </label>
      <label>
        中文姓名
        <input
          name="chineseName"
          defaultValue={fields?.chineseName ?? c?.chineseName}
        />
      </label>
      <label>
        電話
        <input
          name="phone"
          inputMode="tel"
          defaultValue={fields?.phone ?? c?.phone}
        />
      </label>
      <label>
        居住地
        <input name="address" defaultValue={fields?.address ?? c?.address} />
      </label>
      <label>
        工作
        <input
          name="occupation"
          defaultValue={fields?.occupation ?? c?.occupation}
        />
      </label>
      <label className="birthday-field">
        生日
        <span>
          <input
            name="birthday"
            type="date"
            defaultValue={fields?.birthday ?? c?.birthday}
          />
          <button
            type="button"
            onClick={(event) => {
              const input = event.currentTarget
                .closest("span")
                ?.querySelector<HTMLInputElement>('input[name="birthday"]');
              if (input) {
                input.value = "";
                input.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }}
          >
            清除
          </button>
        </span>
      </label>
      <label>
        顧客備註
        <textarea
          className="customer-notes-input"
          name="notes"
          rows={3}
          defaultValue={fields?.notes ?? c?.notes}
        />
      </label>
    </>
  );
  const colorChoices = (
    name: "frameColor" | "profileColor",
    current: string,
    allowWhite = false,
  ) => (
    <div className="color-palette">
      {allowWhite && (
        <label title="白色">
          <input
            type="radio"
            name={name}
            value="#ffffff"
            defaultChecked={current === "#ffffff"}
          />
          <span style={{ background: "#ffffff" }} />
        </label>
      )}
      {TIMETREE_COLORS.map((c) => (
        <label key={c.value} title={c.name}>
          <input
            type="radio"
            name={name}
            value={c.value}
            defaultChecked={current.toLowerCase() === c.value.toLowerCase()}
          />
          <span style={{ background: c.value }} />
          <small>{c.name}</small>
        </label>
      ))}
    </div>
  );
  const extras = (
    <>
      <details className="choice-dropdown" open={chosenAddons.length > 0}>
        <summary>
          加購項目{" "}
          <span>
            {chosenAddons.length ? `已選 ${chosenAddons.length} 項` : "未選擇"}
          </span>
        </summary>
        <fieldset className="extras">
          {addons.map((x) => (
            <label key={x.id}>
              <input
                type="checkbox"
                checked={chosenAddons.includes(x.name)}
                onChange={() =>
                  setChosenAddons((v) =>
                    v.includes(x.name)
                      ? v.filter((n) => n !== x.name)
                      : [...v, x.name],
                  )
                }
              />
              <span>
                <b>{x.name}</b>
                <small>
                  ＋{x.duration} 分鐘 · {money(x.price)}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
      </details>
      <details className="choice-dropdown" open={chosenCoupons.length > 0}>
        <summary>
          優惠券{" "}
          <span>
            {chosenCoupons.length
              ? `已選 ${chosenCoupons.length} 張`
              : "未選擇"}
          </span>
        </summary>
        <fieldset className="extras coupons">
          {couponItems.map((x) => (
            <label key={x.id}>
              <input
                type="checkbox"
                checked={chosenCoupons.includes(x.name)}
                onChange={() =>
                  setChosenCoupons((v) =>
                    v.includes(x.name)
                      ? v.filter((n) => n !== x.name)
                      : [...v, x.name],
                  )
                }
              />
              <span>
                <b>{x.name}</b>
                <small>－{money(x.discount)}</small>
              </span>
            </label>
          ))}
        </fieldset>
      </details>
      <div className="calculated">
        <span>
          <small>預計時間</small>
          <b>{duration} 分鐘</b>
        </span>
        <span>
          <small>應收總額</small>
          <b>{money(total)}</b>
        </span>
      </div>
      {editAppt && service !== CANCEL_SERVICE && (
        <label className="paid-price">
          實收金額（包含小費或額外折扣）
          <div>
            <input
              type="number"
              min="0"
              value={paid}
              onChange={(e) => setPaid(Number(e.target.value))}
            />
          </div>
          <small>選項變更時會自動重新計算，之後仍可手動調整小費或折扣。</small>
        </label>
      )}
    </>
  );
  const addCatalog = async (
    e: React.FormEvent<HTMLFormElement>,
    kind: string,
  ) => {
    e.preventDefault();
    const r = await post({
      kind,
      ...Object.fromEntries(new FormData(e.currentTarget)),
    });
    if (r.ok) {
      e.currentTarget.reset();
      await load();
    }
  };
  const sortButtons = (
    kind: "service" | "addon" | "coupon",
    id: number,
    index: number,
    length: number,
  ) => (
    <div className="sort-buttons">
      <span>排序</span>
      <button
        type="button"
        disabled={index === 0}
        onClick={() => reorderCatalog(kind, id, -1)}
      >
        ↑
      </button>
      <button
        type="button"
        disabled={index === length - 1}
        onClick={() => reorderCatalog(kind, id, 1)}
      >
        ↓
      </button>
    </div>
  );
  const itemEditor = (x: Item, kind: "service" | "addon") => {
    const list = kind === "service" ? serviceCatalog : addonCatalog,
      index = list.findIndex((i) => i.id === x.id);
    return (
      <form
        className="catalog-row"
        key={x.id}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          patch({
            kind,
            id: x.id,
            name: f.get("name"),
            duration: Number(f.get("duration")),
            price: Number(f.get("price")),
          });
        }}
      >
        {sortButtons(kind, x.id, index, list.length)}
        <input name="name" required defaultValue={x.name} />
        <div>
          <label>
            分鐘
            <input
              name="duration"
              type="number"
              min="0"
              defaultValue={x.duration}
            />
          </label>
          <label>
            NT$
            <input name="price" type="number" min="0" defaultValue={x.price} />
          </label>
        </div>
        <div className="catalog-buttons">
          <button type="submit">儲存變更</button>
          <button
            type="button"
            className="delete-item"
            onClick={() => deleteCatalog(kind, x)}
          >
            刪除
          </button>
        </div>
      </form>
    );
  };
  const couponEditor = (x: Coupon) => {
    const index = couponCatalog.findIndex((i) => i.id === x.id);
    return (
      <form
        className="catalog-row"
        key={x.id}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          patch({
            kind: "coupon",
            id: x.id,
            name: f.get("name"),
            discount: Number(f.get("discount")),
          });
        }}
      >
        {sortButtons("coupon", x.id, index, couponCatalog.length)}
        <input name="name" required defaultValue={x.name} />
        <label>
          折扣 NT$
          <input
            name="discount"
            type="number"
            min="0"
            defaultValue={x.discount}
          />
        </label>
        <div className="catalog-buttons">
          <button type="submit">儲存變更</button>
          <button
            type="button"
            className="delete-item"
            onClick={() => deleteCatalog("coupon", x)}
          >
            刪除
          </button>
        </div>
      </form>
    );
  };
  const catalogAdders =
    tab === "services" ? (
      <section className="content catalog-add consolidated-catalog">
        <div className="history-safe">
          <b>歷史紀錄會永久保留</b>
          <p>
            這裡只整合顯示方式，不會刪除任何資料。刪除選項前仍會再次確認，過去的顧客紀錄也會保留。
          </p>
        </div>
        <details className="catalog-section">
          <summary>
            主服務 <span>{serviceCatalog.length} 項</span>
          </summary>
          <div className="catalog-section-body">
            {serviceCatalog.map((x) => itemEditor(x, "service"))}
            <form
              className="catalog-new"
              onSubmit={(e) => addCatalog(e, "newService")}
            >
              <h3>＋ 新增主服務</h3>
              <input name="name" required placeholder="服務名稱" />
              <div>
                <input
                  name="duration"
                  type="number"
                  min="0"
                  required
                  placeholder="分鐘"
                />
                <input
                  name="price"
                  type="number"
                  min="0"
                  required
                  placeholder="價格"
                />
              </div>
              <button className="primary">新增主服務</button>
            </form>
          </div>
        </details>
        <details className="catalog-section">
          <summary>
            加購項目 <span>{addonCatalog.length} 項</span>
          </summary>
          <div className="catalog-section-body">
            {addonCatalog.map((x) => itemEditor(x, "addon"))}
            <form
              className="catalog-new"
              onSubmit={(e) => addCatalog(e, "newAddon")}
            >
              <h3>＋ 新增加購項目</h3>
              <input name="name" required placeholder="加購名稱" />
              <div>
                <input
                  name="duration"
                  type="number"
                  min="0"
                  required
                  placeholder="分鐘"
                />
                <input
                  name="price"
                  type="number"
                  min="0"
                  required
                  placeholder="價格"
                />
              </div>
              <button className="primary">新增加購</button>
            </form>
          </div>
        </details>
        <details className="catalog-section">
          <summary>
            優惠券 <span>{couponCatalog.length} 項</span>
          </summary>
          <div className="catalog-section-body">
            {couponCatalog.map(couponEditor)}
            <form
              className="catalog-new"
              onSubmit={(e) => addCatalog(e, "newCoupon")}
            >
              <h3>＋ 新增優惠券</h3>
              <input name="name" required placeholder="優惠券名稱" />
              <input
                name="discount"
                type="number"
                min="0"
                required
                placeholder="折扣金額"
              />
              <button className="primary">新增優惠券</button>
            </form>
          </div>
        </details>
      </section>
    ) : null;
  const breakdownSection = (
    title: string,
    rows: { name: string; count: number; amount: number }[],
    deduction = false,
  ) => (
    <div className="monthly-breakdown">
      <h3>{title}</h3>
      <div className="breakdown-head">
        <span>名稱</span>
        <span>次數</span>
        <span>{deduction ? "扣除金額" : "總金額"}</span>
      </div>
      {rows.length ? (
        rows.map((row) => (
          <div className="breakdown-row" key={row.name}>
            <span title={row.name}>{row.name}</span>
            <b>{row.count}次</b>
            <strong>
              {deduction ? "－" : ""}
              {money(row.amount)}
            </strong>
          </div>
        ))
      ) : (
        <p className="breakdown-empty">本月尚無紀錄</p>
      )}
    </div>
  );
  const todayDate = iso(new Date());
  function closeDayDetail() {
    setDayDetailOpen(false);
    setDayDetailDragging(false);
    setDayDetailPull(0);
    dayDetailPullAmount.current = 0;
    dayDetailPullStart.current = null;
    lastTappedDay.current = "";
  }
  function startDayDetailPull(e: React.PointerEvent<HTMLElement>) {
    dayDetailPullStart.current = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function moveDayDetailPull(e: React.PointerEvent<HTMLElement>) {
    if (dayDetailPullStart.current === null) return;
    const distance = Math.max(0, e.clientY - dayDetailPullStart.current);
    dayDetailPullAmount.current = Math.min(distance, 180);
    setDayDetailPull(dayDetailPullAmount.current);
  }
  function endDayDetailPull() {
    if (dayDetailPullAmount.current >= 58) closeDayDetail();
    else {
      dayDetailPullAmount.current = 0;
      setDayDetailPull(0);
    }
    dayDetailPullStart.current = null;
  }
  function selectCalendarDay(cellDate: string, target: HTMLButtonElement) {
    const viewport = calendarViewport.current;
    viewport
      ?.querySelectorAll(".grid button.on")
      .forEach((button) => button.classList.remove("on"));
    target.classList.add("on");
    setDay(cellDate);
    if (lastTappedDay.current === cellDate) {
      lastTappedDay.current = "";
      const weekdayRow = target
          .closest(".calendar")
          ?.querySelector<HTMLElement>(".week"),
        weekdayTop = weekdayRow?.getBoundingClientRect().top;
      setDayDetailTop(
        Math.max(
          96,
          Math.min(
            window.innerHeight - 260,
            weekdayTop ?? window.innerHeight * 0.2,
          ),
        ),
      );
      setDayDetailPull(0);
      setDayDetailDragging(false);
      setDayDetailOpen(true);
    } else {
      lastTappedDay.current = cellDate;
      setDayDetailOpen(false);
    }
  }
  const calendarGrid = (viewMonth: Date) => {
    const viewFirst = new Date(
        viewMonth.getFullYear(),
        viewMonth.getMonth(),
        1,
      ),
      viewDays = new Date(
        viewMonth.getFullYear(),
        viewMonth.getMonth() + 1,
        0,
      ).getDate(),
      leadingDays = viewFirst.getDay(),
      totalCells = Math.max(35, Math.ceil((leadingDays + viewDays) / 7) * 7),
      gridStart = new Date(
        viewMonth.getFullYear(),
        viewMonth.getMonth(),
        1 - leadingDays,
      ),
      viewCells = Array.from(
        { length: totalCells },
        (_, i) =>
          new Date(
            gridStart.getFullYear(),
            gridStart.getMonth(),
            gridStart.getDate() + i,
          ),
      );
    return (
      <div className="grid">
        {viewCells.map((cell, i) => {
          const cellDate = iso(cell),
            isOtherMonth = cell.getMonth() !== viewMonth.getMonth(),
            holiday = showHolidays ? holidayText(cellDate) : "",
            cellAppointments = appointments
              .filter((a) => occursOn(a, cellDate))
              .sort(
                (a, b) =>
                  Number(!!b.allDay) - Number(!!a.allDay) ||
                  a.time.localeCompare(b.time),
              );
          return (
            <button
              key={i}
              data-date={cellDate}
              className={`${day === cellDate ? "on" : ""} ${isOtherMonth ? "other-month" : ""}`}
              onClick={(e) => selectCalendarDay(cellDate, e.currentTarget)}
            >
              <b className={cellDate === todayDate ? "today-date" : ""}>
                {cell.getDate()}
              </b>
              {showLunar && (
                <small className="calendar-meta">
                  <span className="lunar-date">{lunarText(cellDate)}</span>
                </small>
              )}
              {(holiday || cellAppointments.length > 0) && (
                <small className="day-bookings">
                  {holiday && (
                    <span className="holiday-booking" title={holiday}>
                      {holiday}
                    </span>
                  )}
                  {cellAppointments.map((a) => {
                    const isRange = !!(
                        a.personal &&
                        a.endDate &&
                        a.endDate > a.date
                      ),
                      weekday = new Date(`${cellDate}T12:00:00`).getDay(),
                      rangeStart =
                        isRange && (cellDate === a.date || weekday === 0),
                      rangeEnd =
                        isRange && (cellDate === a.endDate || weekday === 6),
                      showName =
                        !isRange || weeklyRangeMiddle(a, cellDate) === cellDate;
                    return (
                      <span
                        key={a.id}
                        className={`draggable-booking ${a.status === "cancelled" ? "cancelled" : ""} ${isRange ? "range-event" : ""} ${rangeStart ? "range-start" : ""} ${rangeEnd ? "range-end" : ""}`}
                        title={a.customerName}
                        style={{ backgroundColor: a.color || "#4AAFE8" }}
                        onPointerDown={(e) => startLongPress(e, a.id)}
                        onPointerMove={moveLongPress}
                        onPointerUp={endLongPress}
                        onPointerCancel={cancelLongPress}
                        onContextMenu={(e) => e.preventDefault()}
                        draggable={false}
                      >
                        {showName ? (
                          <>
                            {a.label === "新顧客" && (
                              <i className="new-customer-star">★</i>
                            )}
                            {a.customerName}
                          </>
                        ) : (
                          " "
                        )}
                      </span>
                    );
                  })}
                </small>
              )}
            </button>
          );
        })}
      </div>
    );
  };
  const financeCalendarGrid = (viewMonth: Date) => {
    const viewFirst = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1),
      viewDays = new Date(
        viewMonth.getFullYear(),
        viewMonth.getMonth() + 1,
        0,
      ).getDate(),
      leadingDays = viewFirst.getDay(),
      totalCells = Math.max(35, Math.ceil((leadingDays + viewDays) / 7) * 7),
      gridStart = new Date(
        viewMonth.getFullYear(),
        viewMonth.getMonth(),
        1 - leadingDays,
      ),
      viewCells = Array.from(
        { length: totalCells },
        (_, i) =>
          new Date(
            gridStart.getFullYear(),
            gridStart.getMonth(),
            gridStart.getDate() + i,
          ),
      ),
      weekSlots = Array.from({ length: totalCells / 7 }, (_, weekIndex) => {
        const firstIndex = weekIndex * 7,
          weekStart = iso(viewCells[firstIndex]),
          weekEnd = iso(viewCells[firstIndex + 6]),
          slots = Array.from({ length: 7 }, () =>
            Array<FinanceRecord | null>(4).fill(null),
          ),
          weekRecords = financeRecords
            .filter(
              (record) =>
                record.date <= weekEnd &&
                (record.endDate || record.date) >= weekStart,
            )
            .sort(compareFinanceRecords),
          ranges = weekRecords.filter(
            (record) => !!record.endDate && record.endDate > record.date,
          ),
          singles = weekRecords.filter(
            (record) => !record.endDate || record.endDate <= record.date,
          );

        for (const record of ranges) {
          const start = Math.max(
              0,
              Math.round((dateValue(record.date) - dateValue(weekStart)) / 86400000),
            ),
            end = Math.min(
              6,
              Math.round(
                (dateValue(record.endDate || record.date) - dateValue(weekStart)) /
                  86400000,
              ),
            ),
            lane = [0, 1, 2, 3].find((candidate) =>
              Array.from(
                { length: end - start + 1 },
                (_, offset) => start + offset,
              ).every((dayIndex) => !slots[dayIndex][candidate]),
            );
          if (lane === undefined) continue;
          for (let dayIndex = start; dayIndex <= end; dayIndex++)
            slots[dayIndex][lane] = record;
        }

        for (const record of singles) {
          const dayIndex = Math.round(
              (dateValue(record.date) - dateValue(weekStart)) / 86400000,
            ),
            lane = slots[dayIndex]?.findIndex((item) => !item) ?? -1;
          if (dayIndex >= 0 && dayIndex <= 6 && lane >= 0)
            slots[dayIndex][lane] = record;
        }
        return slots;
      });
    return (
      <div className="grid finance-grid">
        {viewCells.map((cell, i) => {
          const cellDate = iso(cell),
            isOtherMonth = cell.getMonth() !== viewMonth.getMonth(),
            records = weekSlots[Math.floor(i / 7)][i % 7];
          return (
            <button
              key={i}
              data-date={cellDate}
              className={`${day === cellDate ? "on" : ""} ${isOtherMonth ? "other-month" : ""}`}
              onClick={(e) => selectCalendarDay(cellDate, e.currentTarget)}
            >
              <b className={cellDate === todayDate ? "today-date" : ""}>
                {cell.getDate()}
              </b>
              {records.some(Boolean) && (
                <small className="day-bookings finance-day-items">
                  {records.map((record, lane) => {
                    if (!record)
                      return (
                        <span
                          className="finance-slot-placeholder"
                          key={`slot-${lane}`}
                          aria-hidden="true"
                        />
                      );
                    const meta = financeMeta(record.category),
                      isRange =
                        !!record.endDate && record.endDate > record.date,
                      weekday = cell.getDay(),
                      rangeStart =
                        isRange && (cellDate === record.date || weekday === 0),
                      rangeEnd =
                        isRange &&
                        (cellDate === record.endDate || weekday === 6),
                      showName =
                        !isRange ||
                        weeklyRangeMiddle(record, cellDate) === cellDate;
                    return (
                      <span
                        key={record.id}
                        title={record.name}
                        style={{ backgroundColor: meta.color }}
                        className={`draggable-finance ${isRange ? "range-event" : ""} ${rangeStart ? "range-start" : ""} ${rangeEnd ? "range-end" : ""}`}
                        onPointerDown={(event) =>
                          startFinanceLongPress(event, record)
                        }
                        onPointerMove={moveFinanceLongPress}
                        onPointerUp={endFinanceLongPress}
                        onPointerCancel={cancelFinanceLongPress}
                        onContextMenu={(event) => event.preventDefault()}
                        draggable={false}
                        onClick={(event) => {
                          if (!financeSuppressClick.current) return;
                          event.preventDefault();
                          event.stopPropagation();
                          financeSuppressClick.current = false;
                        }}
                      >
                        <em>{showName ? record.name : ""}</em>
                      </span>
                    );
                  })}
                </small>
              )}
            </button>
          );
        })}
      </div>
    );
  };
  const calendarPanels = useMemo(
    () =>
      calendarMonths.map((viewMonth) => (
        <div
          className="calendar-panel"
          key={`${viewMonth.getFullYear()}-${viewMonth.getMonth()}`}
          style={{
            width: `${100 / calendarMonths.length}%`,
            flexBasis: `${100 / calendarMonths.length}%`,
          }}
        >
          {calendarGrid(viewMonth)}
        </div>
      )),
    [appointments, showHolidays, showLunar, calendarMonths],
  );
  const financeCalendarPanels = useMemo(
    () =>
      calendarMonths.map((viewMonth) => (
        <div
          className="calendar-panel"
          key={`finance-${viewMonth.getFullYear()}-${viewMonth.getMonth()}`}
          style={{
            width: `${100 / calendarMonths.length}%`,
            flexBasis: `${100 / calendarMonths.length}%`,
          }}
        >
          {financeCalendarGrid(viewMonth)}
        </div>
      )),
    [financeRecords, calendarMonths],
  );
  const editingEvent =
    eventEditor && eventEditor !== "new" ? eventEditor : undefined;
  const draftValue = (name: string, fallback: string) =>
    bookingDraft?.fields?.[name] ?? fallback;
  const dailyAppointments = appointments
      .filter((a) => occursOn(a, day))
      .sort(
        (a, b) =>
          Number(a.status === "cancelled") - Number(b.status === "cancelled") ||
          Number(!!b.allDay) - Number(!!a.allDay) ||
          a.time.localeCompare(b.time),
      );
  const appointmentDetailRows = dailyAppointments.map((a) => (
    <article
      onPointerDown={(e) => startLongPress(e, a.id)}
      onPointerMove={moveLongPress}
      onPointerUp={endLongPress}
      onPointerCancel={cancelLongPress}
      onContextMenu={(e) => e.preventDefault()}
      className={`appt draggable-card ${a.status === "cancelled" ? "cancelled" : ""} ${a.personal ? "personal-event" : ""}`}
      style={{
        borderLeft: `4px solid ${a.color || "#4AAFE8"}`,
        paddingLeft: 8,
      }}
      key={a.id}
    >
      <time>
        {a.allDay ? (
          "全天"
        ) : (
          <>
            {a.time}
            <br />
            結束{" "}
            {a.personal && a.endTime
              ? a.endTime
              : finish(a.time, a.duration)}
          </>
        )}
      </time>
      <div>
        <h3>
          {a.personal ? (
            <span className="personal-event-name">{a.customerName}</span>
          ) : (
            <button
              className="customer-name-link"
              onClick={() => {
                const c = customers.find((c) => c.id === a.customerId);
                if (c) setProfile(c);
              }}
            >
              {a.customerName}
            </button>
          )}
          {a.label && (
            <span
              className="event-label"
              style={{ backgroundColor: a.color || "#4AAFE8" }}
            >
              {a.label}
            </span>
          )}
        </h3>
        <p>
          {a.personal
            ? a.allDay
              ? `全天行程 · ${a.date}${a.endDate && a.endDate !== a.date ? ` 至 ${a.endDate}` : ""}`
              : `個人行程 · ${a.time}–${a.endTime || finish(a.time, a.duration)}`
            : `${a.service} · ${a.duration} 分鐘`}
        </p>
        {parse(a.addons).length > 0 && (
          <small>加購：{parse(a.addons).join("、")}</small>
        )}
        {parse(a.coupons).length > 0 && (
          <small>優惠：{parse(a.coupons).join("、")}</small>
        )}
        {!a.personal && (
          <p>
            {money(a.price)}
            {a.status === "cancelled" ? " · 已取消" : ""}
          </p>
        )}
        {a.note && <p className="booking-note">{a.note}</p>}
      </div>
      <div className="appt-actions">
        <button
          className="edit-booking"
          onClick={() =>
            a.personal
              ? (setEventAllDay(!!a.allDay), setEventEditor(a))
              : openEdit(a)
          }
        >
          編輯
        </button>
      </div>
    </article>
  ));
  const financeDetailRows = selectedFinanceRecords.length ? (
    selectedFinanceRecords.map((record) => {
      const meta = financeMeta(record.category),
        isIncome = record.category === "收入";
      return (
        <button
          className={`finance-record${record.system === "booking-income" ? " system-finance-record" : " draggable-finance"}`}
          key={record.id}
          onPointerDown={(event) => startFinanceLongPress(event, record)}
          onPointerMove={moveFinanceLongPress}
          onPointerUp={endFinanceLongPress}
          onPointerCancel={cancelFinanceLongPress}
          onContextMenu={(event) => event.preventDefault()}
          onClick={() => {
            if (financeSuppressClick.current) {
              financeSuppressClick.current = false;
              return;
            }
            openEditFinanceRecord(record);
          }}
        >
          <i style={{ backgroundColor: meta.color }}>
            <FinanceIcon category={record.category} />
          </i>
          <span>
            <b>{record.name}</b>
            {record.note && <small>{record.note}</small>}
          </span>
          <strong className={isIncome ? "income" : "expense"}>
            <span className="finance-sign">{isIncome ? "＋" : "－"}</span>
            {financeMoney(record.amount)}
          </strong>
        </button>
      );
    })
  ) : (
    <p className="finance-empty">這一天尚無收支紀錄</p>
  );
  const financeView = (
      <>
        <section className="calendar finance-calendar">
          <div className="arrows">
            <button onClick={() => scrollCalendarBy(-1)}>‹</button>
            <label className="month-jump" aria-label="選擇要跳轉的月份">
              <strong ref={calendarHeaderLabel}>
                {month.getFullYear()}年 {month.getMonth() + 1}月
              </strong>
              <input
                type="month"
                value={`${month.getFullYear()}-${pad(month.getMonth() + 1)}`}
                min={`${calendarMonths[0].getFullYear()}-${pad(calendarMonths[0].getMonth() + 1)}`}
                max={`${calendarMonths.at(-1)!.getFullYear()}-${pad(calendarMonths.at(-1)!.getMonth() + 1)}`}
                onChange={(event) => jumpCalendarMonth(event.target.value)}
              />
            </label>
            <button onClick={() => scrollCalendarBy(1)}>›</button>
          </div>
          <div className="week">
            {["日", "一", "二", "三", "四", "五", "六"].map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
          <div
            className="calendar-viewport"
            ref={calendarViewport}
            onScroll={scrollCalendar}
          >
            <div
              className="calendar-track"
              style={{ width: `${calendarMonths.length * 100}%` }}
            >
              {financeCalendarPanels}
            </div>
          </div>
        </section>
        <section className="content finance-day-content">
          <div className="finance-day-head">
            <div>
              <small>{day.replaceAll("-", " / ")}</small>
              <h2>每日收支</h2>
            </div>
            <button className="add" onClick={openNewFinanceRecord}>
              ＋ 新紀錄
            </button>
          </div>
          <div className="daily-profit">
            <span>今日淨利潤</span>
            <b className={dailyIncome - dailyExpense < 0 ? "negative" : ""}>
              {dailyIncome - dailyExpense < 0 && (
                <span className="finance-sign">－</span>
              )}
              {financeMoney(Math.abs(dailyIncome - dailyExpense))}
            </b>
          </div>
          <div className="finance-records">
            {selectedFinanceRecords.length ? (
              selectedFinanceRecords.map((record) => {
                const meta = financeMeta(record.category),
                  isIncome = record.category === "收入";
                return (
                  <button
                    className={`finance-record${record.system === "booking-income" ? " system-finance-record" : " draggable-finance"}`}
                    key={record.id}
                    onPointerDown={(event) =>
                      startFinanceLongPress(event, record)
                    }
                    onPointerMove={moveFinanceLongPress}
                    onPointerUp={endFinanceLongPress}
                    onPointerCancel={cancelFinanceLongPress}
                    onContextMenu={(event) => event.preventDefault()}
                    onClick={() => {
                      if (financeSuppressClick.current) {
                        financeSuppressClick.current = false;
                        return;
                      }
                      openEditFinanceRecord(record);
                    }}
                  >
                    <i style={{ backgroundColor: meta.color }}>
                      <FinanceIcon category={record.category} />
                    </i>
                    <span>
                      <b>{record.name}</b>
                      {record.note && <small>{record.note}</small>}
                    </span>
                    <strong className={isIncome ? "income" : "expense"}>
                      <span className="finance-sign">
                        {isIncome ? "＋" : "－"}
                      </span>
                      {financeMoney(record.amount)}
                    </strong>
                  </button>
                );
              })
            ) : (
              <p className="finance-empty">這一天尚無收支紀錄</p>
            )}
          </div>
          <div className="finance-month-summary">
            <div><small>本月收入</small><b>{financeMoney(monthlyFinanceIncome)}</b></div>
            <div><small>本月支出</small><b><span className="finance-sign">－</span>{financeMoney(monthlyFinanceExpense)}</b></div>
            <div><small>本月淨利潤</small><b className={monthlyFinanceIncome - monthlyFinanceExpense < 0 ? "negative" : ""}>{monthlyFinanceIncome - monthlyFinanceExpense < 0 && <span className="finance-sign">－</span>}{financeMoney(Math.abs(monthlyFinanceIncome - monthlyFinanceExpense))}</b></div>
          </div>
        </section>
      </>
    ),
    financeOverviewView = (
      <section
        className="content finance-overview"
        onTouchStart={startReportSwipe}
        onTouchEnd={endReportSwipe}
      >
        <div className="finance-overview-month">
          <button onClick={() => moveReportMonth(-1)}>‹</button>
          <label className="finance-overview-month-picker">
            <small>帳務</small>
            <strong>
              {reportMonth.getFullYear()}年 {reportMonth.getMonth() + 1}月
            </strong>
            <input
              type="month"
              value={`${reportMonth.getFullYear()}-${pad(reportMonth.getMonth() + 1)}`}
              onChange={(event) => jumpReportMonth(event.target.value)}
              aria-label="選擇財務總覽月份"
            />
          </label>
          <button onClick={() => moveReportMonth(1)}>›</button>
        </div>
        {activeFinanceDetail ? (
          <div
            className="finance-detail-view"
            onTouchStart={startFinanceDetailSwipe}
            onTouchEnd={endFinanceDetailSwipe}
          >
            <button
              className="finance-detail-back"
              onClick={() => setFinanceDetailCategory(null)}
            >
              ‹ 返回分類資訊
            </button>
            <div className="finance-detail-title">
              <i style={{ backgroundColor: activeFinanceDetail.color }}>
                <FinanceIcon category={activeFinanceDetail.name} />
              </i>
              <div>
                <h2>{activeFinanceDetail.name}</h2>
                <small>
                  {activeFinanceDetail.count}筆 · {financeMoney(activeFinanceDetail.amount)}
                </small>
              </div>
              <em>左右滑動切換</em>
            </div>
            <div className="finance-detail-records">
              {activeFinanceDetail.records.length ? (
                activeFinanceDetail.records.map((record) => (
                  <div key={record.id}>
                    <time>{record.date.replaceAll("-", "/")}</time>
                    <span>
                      <b>{record.name}</b>
                      {record.note && (
                        <small className="finance-detail-note">{record.note}</small>
                      )}
                    </span>
                    <strong>{financeMoney(record.amount)}</strong>
                  </div>
                ))
              ) : (
                <p className="finance-empty">這個月份尚無紀錄</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="finance-donuts">
              <div className="finance-donut-card">
                <div
                  className="finance-donut"
                  style={{ background: overviewIncome ? "#e7b817" : "#eeeeef" }}
                >
                  <div>
                    <small>收入</small>
                    <b>{financeMoney(overviewIncome)}</b>
                  </div>
                </div>
              </div>
              <div className="finance-donut-card">
                <div
                  className="finance-donut"
                  style={{ background: expenseGradient }}
                >
                  <div>
                    <small>支出</small>
                    <b>{financeMoney(overviewExpense)}</b>
                  </div>
                </div>
              </div>
            </div>
            <div className="finance-profit-card">
              <div className="finance-profit-head">
                <span>當月損益</span>
                <b className={overviewProfit < 0 ? "negative" : "positive"}>
                  {overviewProfit >= 0 ? "＋" : "－"}
                  {financeMoney(Math.abs(overviewProfit))}
                </b>
              </div>
              <div className="finance-profit-bars">
                <span>收入</span>
                <i>
                  <u
                    style={{
                      width: `${Math.max(overviewIncome, overviewExpense) ? (overviewIncome / Math.max(overviewIncome, overviewExpense)) * 100 : 0}%`,
                      backgroundColor: "#e7b817",
                    }}
                  />
                </i>
                <b>{financeMoney(overviewIncome)}</b>
                <span>支出</span>
                <i>
                  <u
                    style={{
                      width: `${Math.max(overviewIncome, overviewExpense) ? (overviewExpense / Math.max(overviewIncome, overviewExpense)) * 100 : 0}%`,
                      backgroundColor: "#e9573f",
                    }}
                  />
                </i>
                <b>{financeMoney(overviewExpense)}</b>
              </div>
            </div>
            <div className="finance-category-info">
              <h2>分類資訊</h2>
              {visibleFinanceCategoryRows.length ? (
                visibleFinanceCategoryRows.map((row) => (
                  <button
                    key={row.name}
                    onClick={() => setFinanceDetailCategory(row.name)}
                  >
                    <i style={{ backgroundColor: row.color }}>
                      <FinanceIcon category={row.name} />
                    </i>
                    <span>
                      {row.name}（{row.percent}%）
                    </span>
                    <b>{row.count}筆</b>
                    <strong>{financeMoney(row.amount)}</strong>
                    <em>›</em>
                  </button>
                ))
              ) : (
                <p className="finance-empty">這個月份尚無收支紀錄</p>
              )}
            </div>
          </>
        )}
      </section>
    );
  return (
    <main
      className={`${driveRole === "viewer" ? "read-only-mode" : ""} ${tab === "cal" ? "calendar-main" : ""}`.trim()}
    >
      <header>
        <div className="brand-head">
          <img src={`${PUBLIC_BASE}/clarte-ear-logo.png`} alt="Clarté Ear" onClick={tapLogo} />
          <div>
            <small>預約管理</small>
            <h1>
              {tab === "cal"
                ? "Clarté Ear 行事曆"
                : tab === "people"
                  ? "顧客資料"
                  : tab === "finance"
                    ? "財務總覽"
                    : "服務價格"}
            </h1>
          </div>
        </div>
        {tab === "cal" && calendarView === "month" && (
          <div className="header-calendar-options">
            <button
              className={showHolidays ? "active" : ""}
              onClick={() =>
                setShowHolidays((v) => {
                  localStorage.setItem("clarte-show-holidays", String(!v));
                  return !v;
                })
              }
            >
              國定假日
            </button>
            <button
              className={showLunar ? "active" : ""}
              onClick={() =>
                setShowLunar((v) => {
                  localStorage.setItem("clarte-show-lunar", String(!v));
                  return !v;
                })
              }
            >
              農曆
            </button>
          </div>
        )}
      </header>
      {tab === "cal" ? (
        <>
          <div className="view-switch">
            <button
              className={calendarView === "month" ? "active" : ""}
              onClick={() => setCalendarView("month")}
            >
              日程安排
            </button>
            <button
              className={calendarView === "finance" ? "active" : ""}
              onClick={() => setCalendarView("finance")}
            >
              財務管理
            </button>
          </div>
          {calendarView === "month" ? (
            <>
              <section className="calendar">
                <div className="arrows">
                  <button onClick={() => scrollCalendarBy(-1)}>‹</button>
                  <label className="month-jump" aria-label="選擇要跳轉的月份">
                    <strong ref={calendarHeaderLabel}>
                      {month.getFullYear()}年 {month.getMonth() + 1}月
                    </strong>
                    <input
                      type="month"
                      value={`${month.getFullYear()}-${pad(month.getMonth() + 1)}`}
                      min={`${calendarMonths[0].getFullYear()}-${pad(calendarMonths[0].getMonth() + 1)}`}
                      max={`${calendarMonths.at(-1)!.getFullYear()}-${pad(calendarMonths.at(-1)!.getMonth() + 1)}`}
                      onChange={(event) => jumpCalendarMonth(event.target.value)}
                    />
                  </label>
                  <button onClick={() => scrollCalendarBy(1)}>›</button>
                </div>
                <div className="week">
                  {["日", "一", "二", "三", "四", "五", "六"].map((x) => (
                    <span key={x}>{x}</span>
                  ))}
                </div>
                <div
                  className="calendar-viewport"
                  ref={calendarViewport}
                  onScroll={scrollCalendar}
                >
                  <div
                    className="calendar-track"
                    style={{ width: `${calendarMonths.length * 100}%` }}
                  >
                    {calendarPanels}
                  </div>
                </div>
              </section>
              <section className="content calendar-day-content">
                <div className="title">
                  <div>
                    <small>{day.replaceAll("-", " / ")}</small>
                    <h2>當日預約</h2>
                  </div>
                  <div className="event-actions">
                    <button
                      className="add secondary-add"
                      onClick={() => {
                        setEventAllDay(false);
                        setEventEditor("new");
                      }}
                    >
                      ＋ 新增行程
                    </button>
                    <button className="add" onClick={openNew}>
                      ＋ 新增預約
                    </button>
                  </div>
                </div>
                {dailyAppointments.map((a) => (
                  <article
                    onPointerDown={(e) => startLongPress(e, a.id)}
                    onPointerMove={moveLongPress}
                    onPointerUp={endLongPress}
                    onPointerCancel={cancelLongPress}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`appt draggable-card ${a.status === "cancelled" ? "cancelled" : ""} ${a.personal ? "personal-event" : ""}`}
                    style={{
                      borderLeft: `4px solid ${a.color || "#4AAFE8"}`,
                      paddingLeft: 8,
                    }}
                    key={a.id}
                  >
                    <time>
                      {a.allDay ? (
                        "全天"
                      ) : (
                        <>
                          {a.time}
                          <br />
                          結束{" "}
                          {a.personal && a.endTime
                            ? a.endTime
                            : finish(a.time, a.duration)}
                        </>
                      )}
                    </time>
                    <div>
                      <h3>
                        {a.personal ? (
                          <span className="personal-event-name">
                            {a.customerName}
                          </span>
                        ) : (
                          <button
                            className="customer-name-link"
                            onClick={() => {
                              const c = customers.find(
                                (c) => c.id === a.customerId,
                              );
                              if (c) setProfile(c);
                            }}
                          >
                            {a.customerName}
                          </button>
                        )}
                        {a.label && (
                          <span
                            className="event-label"
                            style={{ backgroundColor: a.color || "#4AAFE8" }}
                          >
                            {a.label}
                          </span>
                        )}
                      </h3>
                      <p>
                        {a.personal
                          ? a.allDay
                            ? `全天行程 · ${a.date}${a.endDate && a.endDate !== a.date ? ` 至 ${a.endDate}` : ""}`
                            : `個人行程 · ${a.time}–${a.endTime || finish(a.time, a.duration)}`
                          : `${a.service} · ${a.duration} 分鐘`}
                      </p>
                      {parse(a.addons).length > 0 && (
                        <small>加購：{parse(a.addons).join("、")}</small>
                      )}
                      {parse(a.coupons).length > 0 && (
                        <small>優惠：{parse(a.coupons).join("、")}</small>
                      )}
                      {!a.personal && (
                        <p>
                          {money(a.price)}
                          {a.status === "cancelled" ? " · 已取消" : ""}
                        </p>
                      )}
                      {a.note && <p className="booking-note">{a.note}</p>}
                    </div>
                    <div className="appt-actions">
                      <button
                        className="edit-booking"
                        onClick={() =>
                          a.personal
                            ? (setEventAllDay(!!a.allDay), setEventEditor(a))
                            : openEdit(a)
                        }
                      >
                        編輯
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            </>
          ) : financeView}
        </>
      ) : tab === "people" ? (
        <section className="content">
          <div className="search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋姓名或電話"
            />
            <button className="add" onClick={() => setModal("customer")}>
              ＋ 新增顧客
            </button>
          </div>
          {query.trim() &&
            customers
              .filter((c) =>
                (c.name + (c.chineseName || "") + c.phone).includes(query),
              )
              .map((c) => {
                const h = history[c.id] || [];
                return (
                  <button
                    className="person"
                    style={{ borderColor: c.frameColor }}
                    key={c.id}
                    onPointerDown={() => startCustomerPress(c)}
                    onPointerUp={cancelCustomerPress}
                    onPointerMove={cancelCustomerPress}
                    onPointerCancel={cancelCustomerPress}
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={() => {
                      if (customerDidLongPress.current) {
                        customerDidLongPress.current = false;
                        return;
                      }
                      setProfile(c);
                    }}
                  >
                    <i>{c.name[0]}</i>
                    <span>
                      <b>{c.name}</b>
                      <small>
                        {c.phone || "未填電話"} · {h.length} 次回訪
                      </small>
                    </span>
                    <strong>
                      {money(h.reduce((n: number, a: A) => n + a.price, 0))}
                    </strong>
                  </button>
                );
              })}
        </section>
      ) : tab === "finance" ? (
        financeOverviewView
      ) : null}
      {tab === "people" && (
        <section
          className="content monthly-report"
          onTouchStart={startReportSwipe}
          onTouchEnd={endReportSwipe}
        >
          <div className="report-heading">
            <button onClick={() => moveReportMonth(-1)}>‹</button>
            <div>
              <small>每月自動統計</small>
              <h2>
                {reportMonth.getFullYear()}年 {reportMonth.getMonth() + 1}月營收
              </h2>
            </div>
            <button onClick={() => moveReportMonth(1)}>›</button>
          </div>
          <div className="report-stats">
            <div>
              <small>總收入</small>
              <b>{money(monthlyVisits.reduce((n, a) => n + a.price, 0))}</b>
            </div>
            <div>
              <small>平均消費</small>
              <b>
                {money(
                  monthlyVisits.length
                    ? Math.round(
                        monthlyVisits.reduce((n, a) => n + a.price, 0) /
                          monthlyVisits.length,
                      )
                    : 0,
                )}
              </b>
            </div>
            <div className="split-counts report-counts">
              <span>
                <small>預約</small>
                <b>{monthlyVisits.length}</b>
              </span>
              <span>
                <small>取消</small>
                <b>{monthlyCancellations.length}</b>
              </span>
            </div>
            <div className="report-new">
              <small>新顧客</small>
              <b>{monthlyNewCustomers}</b>
            </div>
          </div>
          <div className="monthly-breakdowns">
            {breakdownSection("主服務", monthlyBreakdown.main)}
            {breakdownSection("加購項目", monthlyBreakdown.addons)}
            {breakdownSection("優惠券", monthlyBreakdown.coupons, true)}
          </div>
        </section>
      )}
      {catalogAdders}
      {tab === "people" && (
        <>
          <section className="drive-backup-panel">
            <div>
              <b>Google Drive 備份</b>
              <small>{driveStatus}</small>
              {driveConnection && <small>{driveConnection.email}</small>}
            </div>
            <button onClick={connectDrive} disabled={driveBusy}>
              {driveBusy
                ? "連接中…"
                : driveConnection
                  ? "重新連接"
                  : "連接 Google Drive"}
            </button>
          </section>
          {driveRole !== "viewer" && (
            <div className="backup-tools">
              <button onClick={exportBackup}>匯出資料</button>
              <label>
                匯入資料
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={importBackup}
                />
              </label>
            </div>
          )}
        </>
      )}
      <nav>
        <button
          className={tab === "cal" ? "active" : ""}
          onClick={() => {
            if (tab === "people" || tab === "finance") {
              const target = new Date(
                reportMonth.getFullYear(),
                reportMonth.getMonth(),
                1,
              );
              setMonth(target);
              if (
                !day.startsWith(
                  `${reportMonth.getFullYear()}-${pad(reportMonth.getMonth() + 1)}`,
                )
              )
                setDay(iso(target));
            }
            setTab("cal");
          }}
        >
          <b>▦</b>行事曆
        </button>
        <button
          className={tab === "people" ? "active" : ""}
          onClick={() => {
            if (tab !== "finance")
              setReportMonth(new Date(month.getFullYear(), month.getMonth(), 1));
            setTab("people");
          }}
        >
          <b>♙</b>顧客
        </button>
        <button
          className={`finance-nav ${tab === "finance" ? "active" : ""}`}
          onClick={() => {
            if (tab !== "people")
              setReportMonth(new Date(month.getFullYear(), month.getMonth(), 1));
            setFinanceDetailCategory(null);
            setTab("finance");
          }}
        >
          <b>◔</b>財務
        </button>
        <button
          className={tab === "services" ? "active" : ""}
          onClick={() => setTab("services")}
        >
          <b>♡</b>服務
        </button>
      </nav>
      {dayDetailOpen && tab === "cal" && (
        <div
          className={`overlay day-detail-overlay ${dayDetailDragging ? "dragging-hidden" : ""}`}
          onClick={closeDayDetail}
        >
          <section
            className="day-detail-sheet"
            style={{
              height: `calc(100dvh - ${dayDetailTop}px)`,
              transform: `translateY(${dayDetailPull}px)`,
            }}
            onClick={(event) => event.stopPropagation()}
            aria-label={calendarView === "month" ? "當日預約" : "每日收支"}
          >
            <button
              type="button"
              className="day-detail-handle"
              aria-label="向下拉關閉"
              onPointerDown={startDayDetailPull}
              onPointerMove={moveDayDetailPull}
              onPointerUp={endDayDetailPull}
              onPointerCancel={endDayDetailPull}
            >
              <span />
            </button>
            <div className="day-detail-scroll">
              {calendarView === "month" ? (
                <>
                  <div className="title day-detail-title">
                    <div>
                      <small>
                        {day.replaceAll("-", " / ")}　
                        {[
                          "星期日",
                          "星期一",
                          "星期二",
                          "星期三",
                          "星期四",
                          "星期五",
                          "星期六",
                        ][new Date(`${day}T12:00:00`).getDay()]}
                      </small>
                      <h2>當日預約</h2>
                    </div>
                    <div className="event-actions">
                      <button
                        className="add secondary-add"
                        onClick={() => {
                          setEventAllDay(false);
                          setEventEditor("new");
                        }}
                      >
                        ＋ 新增行程
                      </button>
                      <button className="add" onClick={openNew}>
                        ＋ 新增預約
                      </button>
                    </div>
                  </div>
                  <div className="day-detail-list">
                    {appointmentDetailRows.length ? (
                      appointmentDetailRows
                    ) : (
                      <p className="finance-empty">這一天尚無預約或行程</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="finance-day-head day-detail-title">
                    <div>
                      <small>
                        {day.replaceAll("-", " / ")}　
                        {[
                          "星期日",
                          "星期一",
                          "星期二",
                          "星期三",
                          "星期四",
                          "星期五",
                          "星期六",
                        ][new Date(`${day}T12:00:00`).getDay()]}
                      </small>
                      <h2>每日收支</h2>
                    </div>
                    <button className="add" onClick={openNewFinanceRecord}>
                      ＋ 新紀錄
                    </button>
                  </div>
                  <div className="daily-profit">
                    <span>今日淨利潤</span>
                    <b className={dailyIncome - dailyExpense < 0 ? "negative" : ""}>
                      {dailyIncome - dailyExpense < 0 && (
                        <span className="finance-sign">－</span>
                      )}
                      {financeMoney(Math.abs(dailyIncome - dailyExpense))}
                    </b>
                  </div>
                  <div className="finance-records">{financeDetailRows}</div>
                  <div className="finance-month-summary">
                    <div>
                      <small>本月收入</small>
                      <b>{financeMoney(monthlyFinanceIncome)}</b>
                    </div>
                    <div>
                      <small>本月支出</small>
                      <b><span className="finance-sign">－</span>{financeMoney(monthlyFinanceExpense)}</b>
                    </div>
                    <div>
                      <small>本月淨利潤</small>
                      <b className={monthlyFinanceIncome - monthlyFinanceExpense < 0 ? "negative" : ""}>
                        {monthlyFinanceIncome - monthlyFinanceExpense < 0 && <span className="finance-sign">－</span>}
                        {financeMoney(Math.abs(monthlyFinanceIncome - monthlyFinanceExpense))}
                      </b>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
      {dragPreview && (
        <div
          className="drag-preview"
          style={{
            left: dragPreview.x + 12,
            top: dragPreview.y + 12,
            backgroundColor: dragPreview.color,
          }}
        >
          <b>{dragPreview.name}</b>
          {dragPreview.targetDate && <small>{dragPreview.targetDate}</small>}
        </div>
      )}
      {showWedding && (
        <div
          className="wedding-overlay"
          onClick={() => setShowWedding(false)}
          role="dialog"
          aria-label="結婚照片"
        >
          <img src={`${PUBLIC_BASE}/wedding-photo.jpg`} alt="我們的結婚照片" />
        </div>
      )}
      {transfer && (
        <div className="overlay transfer-overlay">
          <div className="transfer-dialog">
            <h2>變更預約日期</h2>
            <p>
              要將這筆預約移到 <b>{transfer.date}</b>，還是在該日建立副本？
            </p>
            <button className="primary" onClick={() => applyTransfer("move")}>
              移動預約
            </button>
            <button
              className="copy-event"
              onClick={() => applyTransfer("copy")}
            >
              複製預約
            </button>
            <button className="ghost-event" onClick={() => setTransfer(null)}>
              取消
            </button>
          </div>
        </div>
      )}
      {financeTransfer && (
        <div className="overlay transfer-overlay">
          <div className="transfer-dialog">
            <h2>變更收支日期</h2>
            <p>
              要將這筆紀錄移到 <b>{financeTransfer.date}</b>，還是在該日建立副本？
            </p>
            <button
              className="primary"
              onClick={() => applyFinanceTransfer("move")}
            >
              移動紀錄
            </button>
            <button
              className="copy-event"
              onClick={() => applyFinanceTransfer("copy")}
            >
              複製紀錄
            </button>
            <button
              className="ghost-event"
              onClick={() => setFinanceTransfer(null)}
            >
              取消
            </button>
          </div>
        </div>
      )}
      {financeEditor && (
        <div className="overlay" onClick={() => setFinanceEditor(null)}>
          <div
            className="sheet finance-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <u />
            <button className="x" onClick={() => setFinanceEditor(null)}>
              ×
            </button>
            <h2>{financeEditor === "new" ? "新增收支紀錄" : "編輯收支紀錄"}</h2>
            <form onSubmit={saveFinanceRecord}>
              <div className="two">
                <label>
                  開始日期
                  <input
                    type="date"
                    required
                    value={financeDate}
                    onChange={(event) => {
                      setFinanceDate(event.target.value);
                      if (financeEndDate < event.target.value)
                        setFinanceEndDate(event.target.value);
                    }}
                  />
                </label>
                <label>
                  結束日期
                  <input
                    type="date"
                    required
                    min={financeDate}
                    value={financeEndDate}
                    onChange={(event) => setFinanceEndDate(event.target.value)}
                  />
                </label>
              </div>
              <fieldset className="finance-category-picker">
                <legend>收入／支出主項目</legend>
                {FINANCE_CATEGORIES.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    className={financeCategory === item.name ? "selected" : ""}
                    style={{ color: item.color }}
                    onClick={() => {
                      setFinanceCategory(item.name);
                      if (financeEditor === "new") setFinanceName("");
                    }}
                  >
                    <FinanceIcon category={item.name} />
                    <span>{item.name}</span>
                  </button>
                ))}
              </fieldset>
              <label>
                項目名稱
                <input
                  required
                  value={financeName}
                  onChange={(event) => setFinanceName(event.target.value)}
                  placeholder="例如：八月房租"
                  list="finance-name-memory"
                />
                <datalist id="finance-name-memory">
                  {financeSuggestions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </label>
              {financeSuggestions.length > 0 && (
                <div className="finance-memory">
                  <small>記憶：</small>
                  <div>
                    {financeSuggestions.map((name) => (
                      <button
                        type="button"
                        key={name}
                        onClick={() => setFinanceName(name)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label>
                金額
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  required
                  value={financeAmount}
                  onChange={(event) => setFinanceAmount(event.target.value)}
                  placeholder="$"
                />
              </label>
              <label>
                備註
                <textarea
                  value={financeNote}
                  onChange={(event) => setFinanceNote(event.target.value)}
                  placeholder="選填"
                />
              </label>
              <button className="primary">
                {financeEditor === "new" ? "建立紀錄" : "儲存變更"}
              </button>
              {financeEditor !== "new" && (
                <button
                  type="button"
                  className="delete-event"
                  onClick={() => deleteFinanceRecord(financeEditor)}
                >
                  刪除紀錄
                </button>
              )}
            </form>
          </div>
        </div>
      )}
      {eventEditor && (
        <div
          className="overlay"
          onClick={() => {
            setEventEditor(null);
            setEventAllDay(false);
          }}
        >
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <u />
            <button
              className="x"
              onClick={() => {
                setEventEditor(null);
                setEventAllDay(false);
              }}
            >
              ×
            </button>
            <h2>{eventEditor === "new" ? "新增行程" : "編輯行程"}</h2>
            <form className="personal-event-form" onSubmit={savePersonalEvent}>
              <label>
                名稱
                <input
                  name="name"
                  required
                  defaultValue={editingEvent?.customerName}
                  placeholder="行程名稱"
                />
              </label>
              <div className="two">
                <label>
                  開始日期
                  <input
                    name="startDate"
                    type="date"
                    required
                    defaultValue={editingEvent?.date || day}
                  />
                </label>
                <label>
                  結束日期
                  <input
                    name="endDate"
                    type="date"
                    required
                    defaultValue={
                      editingEvent?.endDate || editingEvent?.date || day
                    }
                  />
                </label>
              </div>
              <label className="all-day-choice">
                <input
                  name="allDay"
                  type="checkbox"
                  checked={eventAllDay}
                  onChange={(e) => setEventAllDay(e.target.checked)}
                />
                <span>全天行程</span>
              </label>
              {!eventAllDay && (
                <div className="two event-times">
                  <label>
                    開始時間
                    <input
                      name="start"
                      type="time"
                      required
                      defaultValue={editingEvent?.time || "10:00"}
                    />
                  </label>
                  <label>
                    結束時間
                    <input
                      name="end"
                      type="time"
                      required
                      defaultValue={
                        editingEvent?.endTime ||
                        (editingEvent
                          ? finish(editingEvent.time, editingEvent.duration)
                          : "11:00")
                      }
                    />
                  </label>
                </div>
              )}
              <label>
                活動顏色
                <span
                  className="booking-color-control"
                  style={{ backgroundColor: eventColor }}
                >
                  <input
                    name="color"
                    type="color"
                    value={eventColor}
                    onChange={(e) => setEventColor(e.target.value)}
                  />
                </span>
              </label>
              <label className="booking-note-label">
                本次備註
                <textarea name="note" defaultValue={editingEvent?.note} />
              </label>
              <button className="primary">
                {eventEditor === "new" ? "建立行程" : "儲存變更"}
              </button>
              {editingEvent && (
                <button
                  type="button"
                  className="delete-event"
                  onClick={() => {
                    deleteAppointment(editingEvent.id);
                    setEventEditor(null);
                    setEventAllDay(false);
                  }}
                >
                  刪除行程
                </button>
              )}
            </form>
          </div>
        </div>
      )}
      {modal && (
        <div
          className="overlay"
          onClick={() => (modal === "new" ? closeBookingForm() : setModal(""))}
        >
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <u />
            <h2>{modal === "customer" ? "新增顧客" : "新增預約"}</h2>
            {modal === "customer" ? (
              <form onSubmit={createCustomer}>
                {customerFields()}
                <button className="primary">儲存顧客</button>
              </form>
            ) : (
              <form
                className="booking-draft-form"
                onInput={(e) => saveBookingDraft(e.currentTarget, "new")}
                onSubmit={saveBooking}
              >
                {!inlineNew ? (
                  <fieldset className="customer-picker">
                    <legend>顧客</legend>
                    <button
                      type="button"
                      className="new-customer"
                      onClick={() => setInlineNew(true)}
                    >
                      ＋ 新增顧客
                    </button>
                    <input
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setChosenCustomer(null);
                      }}
                      placeholder="輸入姓名或部分姓名"
                    />
                    {chosenCustomer ? (
                      <div className="selected-customer">
                        <b>{chosenCustomer.name}</b>
                        <button
                          type="button"
                          onClick={() => setChosenCustomer(null)}
                        >
                          更換
                        </button>
                      </div>
                    ) : (
                      customerSearch && (
                        <div className="customer-results">
                          {customers
                            .filter((c) =>
                              (c.name + (c.chineseName || "")).includes(
                                customerSearch,
                              ),
                            )
                            .map((c) => (
                              <button
                                type="button"
                                key={c.id}
                                onClick={() => {
                                  setChosenCustomer(c);
                                  setCustomerSearch(c.name);
                                }}
                              >
                                {c.name}
                              </button>
                            ))}
                        </div>
                      )
                    )}
                  </fieldset>
                ) : (
                  <div className="inline-new">
                    <button
                      type="button"
                      className="back"
                      onClick={() => setInlineNew(false)}
                    >
                      ← 返回搜尋
                    </button>
                    <div className="inline-fields">
                      {customerFields(undefined, bookingDraft?.fields)}
                    </div>
                    <button
                      type="button"
                      className="primary"
                      onClick={async (e) => {
                        const fields =
                          e.currentTarget.parentElement!.querySelectorAll(
                            "input,textarea",
                          );
                        const data: any = { kind: "customer" };
                        fields.forEach((x: any) => (data[x.name] = x.value));
                        const r = await post(data);
                        if (r.ok) {
                          const c = await r.json();
                          setChosenCustomer(c);
                          setCustomerSearch(c.name);
                          setInlineNew(false);
                          await load();
                        }
                      }}
                    >
                      儲存並選擇此顧客
                    </button>
                  </div>
                )}
                <label>
                  主服務
                  <select
                    name="service"
                    defaultValue={service}
                    onChange={(e) => setService(e.target.value)}
                  >
                    <option value={CANCEL_SERVICE}>{CANCEL_SERVICE}</option>
                    {services.map((x) => (
                      <option key={x.id}>{x.name}</option>
                    ))}
                  </select>
                </label>
                {service !== CANCEL_SERVICE && extras}
                <div className="two">
                  <label>
                    日期
                    <input
                      name="date"
                      type="date"
                      defaultValue={draftValue("date", day)}
                    />
                  </label>
                  <label>
                    時間
                    <input
                      name="time"
                      type="time"
                      defaultValue={draftValue("time", "10:00")}
                    />
                  </label>
                </div>
                <div className="two">
                  <label>
                    活動標籤
                    <select
                      name="label"
                      defaultValue={draftValue("label", "新顧客")}
                    >
                      <option>新顧客</option>
                      <option>回訪</option>
                    </select>
                  </label>
                  <label>
                    活動顏色
                    <span
                      className="booking-color-control"
                      style={{ backgroundColor: bookingColor }}
                    >
                      <input
                        name="color"
                        type="color"
                        value={bookingColor}
                        onChange={(e) => setBookingColor(e.target.value)}
                      />
                    </span>
                  </label>
                </div>
                <div className="two repeat-settings">
                  <label>
                    重複預約
                    <select
                      name="repeat"
                      defaultValue={draftValue("repeat", "none")}
                    >
                      <option value="none">不重複</option>
                      <option value="weekly">每週</option>
                      <option value="biweekly">每兩週</option>
                      <option value="monthly">每月</option>
                    </select>
                  </label>
                  <label>
                    建立次數
                    <input
                      name="repeatCount"
                      type="number"
                      min="2"
                      max="24"
                      defaultValue={draftValue("repeatCount", "4")}
                    />
                  </label>
                </div>
                <label className="booking-note-label">
                  本次備註
                  <textarea name="note" defaultValue={draftValue("note", "")} />
                </label>
                <button className="primary" disabled={!chosenCustomer}>
                  建立預約
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      {editAppt && (
        <div className="overlay" onClick={closeBookingForm}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <u />
            <button className="x" onClick={closeBookingForm}>
              ×
            </button>
            <h2>編輯預約</h2>
            <p className="booking-customer">{editAppt.customerName}</p>
            <form
              className="edit-booking-form booking-draft-form"
              onInput={(e) => saveBookingDraft(e.currentTarget, "edit")}
              onSubmit={saveEditBooking}
            >
              <label>
                主服務
                <select
                  key={editAppt.id}
                  name="service"
                  defaultValue={service}
                  onChange={(e) => setService(e.target.value)}
                >
                  <option value={CANCEL_SERVICE}>{CANCEL_SERVICE}</option>
                  {services.map((x) => (
                    <option key={x.id}>{x.name}</option>
                  ))}
                </select>
              </label>
              {service !== CANCEL_SERVICE && extras}
              <div className="two">
                <label>
                  日期
                  <input
                    name="date"
                    type="date"
                    defaultValue={draftValue("date", editAppt.date)}
                  />
                </label>
                <label>
                  時間
                  <input
                    name="time"
                    type="time"
                    defaultValue={draftValue("time", editAppt.time)}
                  />
                </label>
              </div>
              <div className="two">
                <label>
                  活動標籤
                  <select
                    name="label"
                    defaultValue={draftValue(
                      "label",
                      editAppt.label || "新顧客",
                    )}
                  >
                    {editAppt.label &&
                      !["新顧客", "回訪"].includes(editAppt.label) && (
                        <option value={editAppt.label} hidden>
                          {editAppt.label}
                        </option>
                      )}
                    <option>新顧客</option>
                    <option>回訪</option>
                  </select>
                </label>
                <label>
                  活動顏色
                  <span
                    className="booking-color-control"
                    style={{ backgroundColor: bookingColor }}
                  >
                    <input
                      name="color"
                      type="color"
                      value={bookingColor}
                      onChange={(e) => setBookingColor(e.target.value)}
                    />
                  </span>
                </label>
              </div>
              <label className="booking-note-label">
                本次備註
                <textarea
                  name="note"
                  defaultValue={draftValue("note", editAppt.note)}
                />
              </label>
              <button className="primary">儲存變更</button>
            </form>
          </div>
        </div>
      )}
      {profile && (
        <div
          className="overlay"
          onClick={() => {
            setProfile(null);
            setEditProfile(false);
          }}
        >
          <div
            className="sheet customer-profile-sheet"
            style={{ backgroundColor: profile.profileColor }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="x" onClick={() => setProfile(null)}>
              ×
            </button>
            {editProfile ? (
              <>
                <h2>編輯顧客資料</h2>
                <form className="edit-customer" onSubmit={updateCustomer}>
                  {customerFields(profile)}
                  <fieldset className="color-settings timetree-colors">
                    <legend>顧客顏色</legend>
                    <div>
                      <b>資料庫框線</b>
                      {colorChoices("frameColor", profile.frameColor)}
                    </div>
                    <div>
                      <b>檔案背景</b>
                      {colorChoices("profileColor", profile.profileColor, true)}
                    </div>
                  </fieldset>
                  <button className="primary">儲存變更</button>
                </form>
              </>
            ) : (
              <>
                <div className="profile">
                  <i>{profile.name[0]}</i>
                  <h2>{profile.name}</h2>
                  <p>{profile.phone || "未填電話"}</p>
                  <button
                    className="edit-profile"
                    onClick={() => setEditProfile(true)}
                  >
                    ✎ 編輯顧客
                  </button>
                </div>
                <div className="details">
                  <p>
                    <small>居住地</small>
                    {profile.address || "未填寫"}
                  </p>
                  <p>
                    <small>工作</small>
                    {profile.occupation || "未填寫"}
                  </p>
                  <p>
                    <small>生日</small>
                    {profile.birthday || "未填寫"}
                  </p>
                  <p>
                    <small>中文姓名</small>
                    {profile.chineseName || "未填寫"}
                  </p>
                </div>
                <div className="stats">
                  <div className="split-counts">
                    <span>
                      <small>預約次數</small>
                      <b>{history[profile.id]?.length || 0}</b>
                    </span>
                    <span>
                      <small>取消次數</small>
                      <b>
                        {
                          appointments.filter(
                            (a) =>
                              a.customerId === profile.id &&
                              (a.status === "cancelled" ||
                                a.service === CANCEL_SERVICE),
                          ).length
                        }
                      </b>
                    </span>
                  </div>
                  <div>
                    <small>累計消費</small>
                    <b>
                      {money(
                        (history[profile.id] || []).reduce(
                          (n: number, a: A) => n + a.price,
                          0,
                        ),
                      )}
                    </b>
                  </div>
                </div>
                <h3>顧客備註</h3>
                <p className="note">{profile.notes || "尚無備註"}</p>
                <h3>消費紀錄</h3>
                {(history[profile.id] || []).map((a: A) => (
                  <article className="history detailed" key={a.id}>
                    <span>
                      <b>{a.service}</b>
                      {parse(a.addons).length > 0 && (
                        <small>加購：{parse(a.addons).join("、")}</small>
                      )}
                      {parse(a.coupons).length > 0 && (
                        <small>優惠券：{parse(a.coupons).join("、")}</small>
                      )}
                      <small>
                        {a.date} · {a.time} · {a.duration} 分鐘
                      </small>
                    </span>
                    <strong>{money(a.price)}</strong>
                  </article>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
