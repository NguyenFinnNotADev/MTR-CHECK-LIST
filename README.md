<p align="center">
  <img src="public/logo.png" width="128" height="128" alt="MTR Check list logo" style="image-rendering: pixelated">
</p>

<h1 align="center">MTR Check list by NguyenFinn</h1>

<p align="center">
  Sổ theo dõi nguyên liệu công trình Minecraft từ file <b>Material List</b> của Litematica.<br>
  Offline · portable · không cần cài đặt · Windows 10/11
</p>

<p align="center">
  <img alt="Minecraft" src="https://img.shields.io/badge/Minecraft%20Java-1.21.11-5b8731">
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2-24c8db">
  <img alt="React" src="https://img.shields.io/badge/React-18-61dafb">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-0078d6">
</p>

<p align="center"><a href="#english">English below ↓</a></p>

---

## Giới thiệu

Xây công trình lớn bằng Litematica thì danh sách nguyên liệu dài hàng trăm dòng. Trong game chỉ có một bảng chữ khô khan. **MTR Check list** biến file `material_list_*.txt` thành một cuốn sổ trực quan, có icon giống trong game. Bạn biết ngay mình còn thiếu gì, cái nào có máy farm, cái nào phải đi kiếm tay, và đang gom tới đâu.

Tool theo dõi thủ công, không đọc dữ liệu trong game. Bạn tự nhập số đã gom, app lo phần sắp xếp và tính toán.

## Tính năng

### Danh sách nguyên liệu
- **Import file Litematica**: chọn file `material_list_*.txt`, đặt tên công trình và chọn map. Có thể đặt sẵn thư mục `config\litematica` trong Cài đặt để mở nhanh.
- **Chia khu rõ ràng**: Chưa sở hữu ở trên, Đã sở hữu ở dưới đáy. Trong mỗi khu lại tách *Có máy farm* (kèm tên farm) và *Không thể farm*.
- **Nhóm họ hàng**: item liên quan được gom chung, ví dụ thân gỗ sồi, ván, hàng rào, cửa sồi hoặc một loại đá và các chế phẩm của nó. Mặc định nhóm nào có farm làm ra nhiều loại nguyên liệu nhất sẽ đứng đầu. Có thể sắp xếp theo số lượng, theo tên, và đảo ngược thứ tự.
- **3 trạng thái**: Chưa có → Đang thu thập (nhập số đã gom) → Đã đủ. Bấm sang item khác thì item cũ tự về đúng trạng thái: chưa đụng thì về Chưa có, gom đủ thì sang Đã đủ, gom dở thì giữ Đang thu thập.
- **Nguyên liệu thô**: item craft được sẽ hiện bảng nguyên liệu gốc, tính đúng số lần craft (làm tròn lên mỗi bước). Có tổng nguyên liệu thô cho cả nhóm.
- **Quy đổi stack / shulker** cho số lượng lớn.
- **Icon 3D kiểu túi đồ** được dựng từ model của bản 1.21.11: block nhìn nghiêng như trong inventory, kể cả các item dạng entity (rương, giường, đầu mob…).
- **Tên item Anh / Việt / song song**, lấy đúng tên trong game. Chữ "farm" luôn giữ nguyên, không dịch.

### Nhiều công trình, nhiều map
- **Phiên làm việc**: mỗi công trình là một project riêng, lưu tự động. Hôm nay làm nhà, mai qua làm cầu, không ảnh hưởng nhau.
- **Tab Map & Farm**: tick những máy farm đã có trong từng map hoặc server. Mọi công trình của map đó đều hiện "đã có farm".
- **Ghi chú theo map**: ghi chú cho item (lấy ở đâu) và cho farm (máy farm nằm ở toạ độ nào).
- **Tab Kế hoạch farm**: nên xây farm nào trước để phủ được nhiều nguyên liệu nhất.
- **Lịch sử theo ngày**: hôm nay đã gom được bao nhiêu.

### Cửa sổ nhỏ (overlay)
- Nút **"Hiện cửa sổ nhỏ"** mở một cửa sổ gọn chỉ hiện các item đang thu thập, bấm mở rộng để thấy các item cùng nhóm.
- Kéo giãn tuỳ ý, luôn nổi trên cùng, chỉnh độ trong suốt, bật/tắt nguyên liệu thô.
- Đồng bộ 2 chiều với cửa sổ chính. Có tuỳ chọn ẩn cửa sổ chính khi mở cửa sổ nhỏ.

### Giao diện
- **7 theme**: trắng, đen, xám, be cozy, xanh dương pastel, nâu medieval, hồng pastel.
- Font pixel **VT323** cho tiêu đề và số, **Nunito** cho chữ thường, dễ đọc và có đủ dấu tiếng Việt.
- Icon giao diện kiểu pixel lấy từ item Minecraft.
- **Animation 3 mức**: Tắt / Ít / Full. Full có cuộn mượt với motion blur và hiệu ứng nổi, tốn RAM hơn.
- Màn hình loading khi mở app, màn hình "Đang lưu…" khi tắt để không mất dữ liệu.

### Nhẹ và an toàn dữ liệu
- **Portable**: dữ liệu nằm cạnh file exe. Copy cả thư mục sang máy khác là dùng được.
- Ghi file an toàn (atomic) và giữ 10 bản backup tự động. Có xuất / nhập file sao lưu.
- Tối ưu RAM: khoảng 140 MB ở chế độ Ít/Tắt. Khi thu nhỏ cửa sổ, WebView được hạ mức dùng bộ nhớ.

## Cài đặt và sử dụng

1. Tải file `.zip` ở mục [Releases](../../releases) và giải nén ra một thư mục bất kỳ.
2. Trong game: mở schematic bằng Litematica → **Material List** → nút **Write to file**.
   File nằm ở `<instance>\config\litematica\material_list_….txt`.
3. Mở `MTR Check list.exe` → **Chọn file Litematica…** → đặt tên công trình và chọn map.
4. Bấm vào một item để chuyển sang *Đang thu thập* rồi nhập số đã gom. Đủ số thì item tự chuyển *Đã đủ* và xuống khu *Đã sở hữu*.
5. Vào tab **Map & Farm** để tick các farm đã có trong map.

> Cần WebView2 Runtime. Windows 10/11 thường đã có sẵn.

### Cấu trúc thư mục bản phát hành

```
MTR Check list.exe   app
data\                dữ liệu của bạn: công trình, map, cài đặt, file đã import, backup tự động
database\            dữ liệu game: item, nhóm, farm, công thức (sửa tay được)
icons\               icon item + icon giao diện
```

## Build từ mã nguồn

Yêu cầu: Node.js 20+, Rust (stable, MSVC), Visual Studio Build Tools 2022 và WebView2.

```powershell
npm install
npm run dev                 # chạy giao diện trên trình duyệt (dữ liệu demo: ?demo&theme=beige&lang=vi)
npx tauri dev               # chạy app desktop
powershell -ExecutionPolicy Bypass -File scripts\release.ps1   # test + build exe portable
```

### Dựng lại dữ liệu game

Dữ liệu item, công thức và icon được dựng từ file jar Minecraft trên máy bạn, **không** đi kèm repo:

```powershell
node scripts/prepare-assets.mjs   # lấy model, texture, công thức, file ngôn ngữ vi_vn từ jar 1.21.11
npm run data                      # build-db → build-icons → validate-db
```

- Nhóm item và danh sách farm biên soạn tay nằm ở `curated/catalog.mjs`.
- Muốn nâng phiên bản Minecraft thì sửa `MC_VERSION_DIR` trong `scripts/prepare-assets.mjs` rồi chạy lại hai lệnh trên.

### Công nghệ

| Phần | Dùng |
|---|---|
| App | Tauri 2 (Rust) + WebView2 |
| Giao diện | React 18, TypeScript strict, Vite, Zustand |
| Dữ liệu | Script Node: parse công thức, chọn công thức rẻ nhất, dựng icon 3D bằng renderer isometric viết tay |
| Test | Vitest |

Spec đầy đủ của dự án được viết bằng [Spec Kit](https://github.com/github/spec-kit), nằm trong `specs/001-material-tracker/`.

## Pháp lý

Mã nguồn phát hành theo giấy phép [MIT](LICENSE). MTR Check list là dự án cá nhân, **không liên kết với Mojang hay Microsoft**. Minecraft, tên item và texture là tài sản của Mojang AB. Litematica là mod của maruohon.

---

<a id="english"></a>

## English

**MTR Check list** is an offline, portable Windows app that turns a Litematica `material_list_*.txt` into a cozy visual checklist with in-game style icons (Minecraft Java 1.21.11).

- Splits materials into **missing / owned**, then **farmable (with farm name) / not farmable**, then groups of related items (e.g. oak log, planks, fence, door).
- Three states: *Missing → Collecting* (type in how many you have) *→ Done*.
- Raw-material breakdown for craftable items, per item and per group, with stack and shulker conversion.
- Several projects and maps: tick the farms you own per map, notes per map for items and farms, a farm-priority plan and daily history.
- An always-on-top **mini window** for the items you are collecting, synced with the main window.
- 7 themes, a VT323 pixel font, EN / VI / bilingual item names, and three animation levels.
- Portable data next to the exe, atomic saves and 10 automatic backups, about 140 MB RAM.

**Use:** download the release zip and unzip it. In game, use Litematica → Material List → *Write to file*. Then open `MTR Check list.exe` → *Pick Litematica file…*.

**Build:** `npm install`, then `node scripts/prepare-assets.mjs && npm run data`, then `scripts\release.ps1`. This needs Node 20+, Rust (MSVC) and VS Build Tools 2022.

Not affiliated with Mojang or Microsoft. Minecraft assets belong to Mojang AB.
