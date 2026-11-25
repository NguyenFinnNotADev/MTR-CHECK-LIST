# MTR Check list by NguyenFinn — Spec Kit prompts

Cách dùng: chạy `specify init . --ai claude` trong `D:\App\MTR Check list by NguyenFinn\_source`, sau đó dán lần lượt từng khối bên dưới vào lệnh tương ứng. Thứ tự: `/speckit.constitution` → `/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`.

Tài liệu tham chiếu nằm trong repo:
- `_source/docs/mockups/cabin.png`, `night.png`, `meadow.png`: 3 theme đã duyệt.
- `_source/docs/mockups/group-total.png`: dòng tổng nguyên liệu thô của nhóm (đã duyệt, mặc định thu gọn).
- `_source/docs/mockups/mockup.html`: HTML/CSS gốc của mockup, dùng làm điểm xuất phát cho token màu.
- `_source/docs/sample/material_list_2026-11-24_18.52.58.txt`: file Litematica mẫu (Adventure Time Tree House).

---

## 1. `/speckit.constitution`

```
Tạo constitution cho dự án "MTR Check list by NguyenFinn": app desktop Windows, offline, để theo dõi việc gom nguyên liệu cho công trình Minecraft từ file material list của mod Litematica.

Nguyên tắc bắt buộc:
1. Offline tuyệt đối: app chạy không cần internet. Mọi font, icon, dữ liệu đều đóng gói cục bộ. Không gọi mạng, không telemetry.
2. Portable: cả app là một folder. Copy folder sang máy Windows 10/11 khác là chạy được, không cần cài đặt, không ghi registry, không ghi AppData. Mọi dữ liệu nằm cạnh file exe.
3. Nhẹ: ưu tiên RAM thấp (mục tiêu < 80 MB khi chạy với project 300 loại item) và exe nhỏ. Dùng WebView2 có sẵn của Windows, không đóng gói Chromium.
4. Không mất dữ liệu: mọi thay đổi tự lưu (debounce ≤ 1 s), ghi file kiểu atomic (ghi file tạm rồi rename), có backup xoay vòng. App không bao giờ crash vì file import lạ hoặc item chưa biết.
5. Dữ liệu game nằm ngoài code: danh sách item, nhóm, farm, công thức, tên dịch nằm trong JSON ở `database\`, sửa được không cần build lại. Cập nhật phiên bản Minecraft = thay dữ liệu + chạy lại script, không sửa code UI.
6. Tên item chính xác 100% theo file ngôn ngữ chính thức của Minecraft (en_us / vi_vn). Tên farm chỉ cần đúng tương đối, nhưng từ "farm" KHÔNG BAO GIỜ được dịch thành "trang trại", luôn giữ nguyên "farm".
7. Giao diện cozy, đơn giản, rõ ràng. Mọi item đều có icon. Co giãn theo kích thước cửa sổ (tối thiểu 1024×640), chỉ cho desktop, không cần mobile.
8. Code TypeScript strict. Logic thuần (parser, tính nguyên liệu thô, sắp xếp, phân vùng) tách khỏi UI và có unit test.
```

---

## 2. `/speckit.specify`

```
Xây app "MTR Check list by NguyenFinn": người chơi Minecraft (Java 1.21.11) chọn file material list xuất từ mod Litematica, app hiện danh sách nguyên liệu dạng sổ theo dõi trực quan có icon, giúp theo dõi và gom nguyên liệu tiện nhất. Làm thủ công, không đồng bộ realtime với game.

## Khái niệm
- Map: một thế giới/server (vd "Polym 21.11", "Survival riêng"). Người dùng tạo, đổi tên, xóa map.
- Project (= một phiên làm việc): một công trình, thuộc đúng 1 map. Có tên (mặc định lấy tên schematic trong file), ngày tạo, ngày sửa cuối, % hoàn thành. Có nhiều project song song và độc lập: đang làm dở công trình A có thể chuyển qua B, hôm sau quay lại A, mọi trạng thái còn nguyên. Các project không dùng chung kho đồ.
- Item: một dòng trong file Litematica (tên tiếng Anh + số Total).
- Nhóm (group): họ hàng nguyên liệu cùng gốc. Ví dụ "Spruce" gồm Spruce Log/Wood, Stripped Spruce Log/Wood, Planks, Stairs, Slab, Fence, Fence Gate, Door, Trapdoor, Sign, Hanging Sign, Pressure Plate, Button. "Deepslate" gồm Cobbled Deepslate, Polished, Bricks, Tiles và các stairs/slab/wall của chúng. "Wool" gồm mọi màu len. "Concrete" gồm mọi màu bê tông.
- Farm: máy farm trong Minecraft Java 1.21.11 tạo ra nguyên liệu gốc của nhóm (vd Tree Farm (Spruce), Sheep Farm (wool), Melon Farm, Sand farm, Gravel farm, Iron Farm, Bamboo Farm, Sea Pickle farm, Gold Farm (Piglin), Mud farm, Rooted Dirt farm…), dựa trên kiến thức cộng đồng (Minecraft Wiki, ilmango, Mumbo Jumbo, TheMisterEpic…).

## Import
- Nút "📂 Chọn file Litematica…" mở hộp thoại chọn file `.txt`. (Không kéo thả, không dán text, không theo dõi folder.)
- Định dạng file: bảng ASCII có dòng tiêu đề `Material List for schematic '<TÊN>' (x of y regions)`, các cột `Item | Total | Missing | Available`. Chỉ dùng `Item` và `Total`. BỎ QUA hoàn toàn cột Missing và Available.
- Import luôn tạo PROJECT MỚI: hỏi tên (mặc định tên schematic) và map. Lưu bản gốc file vào `data\imports\`.
- Tên tiếng Anh được map sang id Minecraft (vd "Lime Wool" → `minecraft:lime_wool`, "Iron Chain" → `minecraft:iron_chain`, "Block of Bamboo" → `minecraft:bamboo_block`) bằng cách tra ngược file ngôn ngữ en_us.
- Dòng không nhận ra hoặc chưa có trong database vẫn được import, đưa vào mục "Chưa phân loại".

## Trạng thái item (dạng sổ)
Mỗi khi click vào 1 nhóm item khác sẽ tự động chuyển thành chế độ đang thu thập
Mỗi item có đúng 3 trạng thái, chọn bằng 3 nút liền nhau: Chưa có / Đang thu thập / Đã đủ. màu : Cam/ Xanh dương/ xanh lá
Mỗi khi click vào 1 nhóm item khác ,nếu nhóm item trước đó đã đủ sẽ tự động chuyển thành chế độ đang thu thập, nếu trước đó chưa xong thì không chuyển trạng thái khi tick vào item khác trừ khi thao tác thủ công.
- Chưa có: mặc định khi import.
- Đang thu thập: hàng TỰ MỞ RỘNG và ĐỔI MÀU (nền màu nhạt, viền trái đậm như mockup và cùng màu với nút trạng thái). Phần mở rộng hiện:
  • ô "Đã gom" nhập số tay, kèm nút +64 và + 1 Sulker box (+ 1728 item). Số này được lưu để hôm sau làm tiếp;
  • thanh tiến độ đã gom / tổng;
  • nếu item craft được: chuỗi nguyên liệu thô tới gốc, kèm số lượng cần và số còn thiếu đã trừ phần đã gom (vd 7 992 Stripped Spruce Wood → 10 656 Spruce Log; còn thiếu 5 964). 
  Chỉ trạng thái này mới hiện nguyên liệu thô của từng item, không có nút mở rộng riêng cho các trạng thái khác.
- Đã đủ: item chuyển xuống khu "Đã sở hữu".
- Đang thu thập mà số đã gom ≥ tổng thì tự chuyển sang Đã đủ. Đổi trạng thái không xóa số đã gom.
- Số lượng luôn hiện kèm quy đổi theo đúng max stack của item: "5 shulker + 321". Item stack 16 (sign, banner, egg…) hoặc không stack (bucket, bed, cake) quy đổi đúng.

## Bố cục màn hình chính (theo mockup)
- Sidebar trái: logo + tên app; project gom theo map (tên, số loại, % tiến độ); nút chọn file; tab dưới cùng: Nguyên liệu / Map & Farm / Cài đặt.
- Header: tên project, chip map, tiến độ "x / y loại" + %.
- Thanh công cụ: ô tìm kiếm (theo tên EN và VI); nút sắp xếp: "Farm ra nhiều loại nhất" (mặc định), "Số lượng", "Tên A–Z", nút ⇅ đảo thứ tự; nút lọc nhanh theo trạng thái.
- Nội dung chia dọc 2 khu:
  1) KHU CHƯA SỞ HỮU (trên): item Chưa có + Đang thu thập. Bên trong chia "🌱 Farm được" rồi "🪨 Không farm được". Mỗi phần là các thẻ NHÓM; trong thẻ là các hàng item.
  2) KHU ĐÃ SỞ HỮU (dưới đáy): item Đã đủ, cùng cấu trúc nhóm, hiện mờ hơn. Có thanh tóm tắt (số loại + vài icon) và nút thu gọn/mở. Mục đích: cuộn xuống khi muốn kiểm tra lại.
- Header nhóm: tên nhóm (theo ngôn ngữ), badge farm (tên farm; xanh và "✔ đã có" nếu map của project đã có farm đó; nhóm không farm được thì badge "✖ Không farm" + 1 dòng ngắn cách kiếm, vd "Đào ở tầng Y<0", "Đổi với Wandering Trader", "Loot Ancient City"), số loại và tổng số khối.
- Dòng tổng nguyên liệu thô của nhóm (group-total.png): MẶC ĐỊNH THU GỌN, bấm vào header nhóm mới mở. Hiện tổng nguyên liệu gốc cả nhóm cần, phần còn thiếu, quy ra shulker và % tiến độ. Nhóm có nhiều nguyên liệu gốc (Concrete → Sand, Gravel, Dye) thì hiện nhiều chip.
- Nhóm nhiều nguyên liệu gốc từ nhiều farm (vd Concrete) thì badge ghi chuỗi farm: "Sand farm + Gravel farm + Dye".

## Sắp xếp
- Mặc định "Farm ra nhiều loại nhất": trong mỗi phần (Farm được / Không farm được), nhóm có farm ĐÃ CÓ trong map lên trước; rồi đến nhóm chứa nhiều LOẠI item nhất trong project. Hòa thì theo tổng số lượng.
- "Số lượng": theo tổng số khối của nhóm; item trong nhóm theo Total.
- "Tên A–Z": theo tên nhóm/item ở ngôn ngữ đang hiển thị.
- ⇅ đảo thứ tự kiểu đang chọn. Kiểu sắp xếp và ngôn ngữ được lưu.
- Trong nhóm, item Đang thu thập luôn lên đầu.

## Tab Map & Farm
- Danh sách map (thêm / đổi tên / xóa, có xác nhận; xóa map phải chọn chuyển các project sang map khác hoặc xóa luôn).
- Mỗi map có checklist mọi farm trong database (icon sản phẩm, tên farm, nhóm nó phục vụ), tick "map này có farm này". Lưu THEO MAP. Mọi project thuộc map đó đều thấy "✔ đã có farm", kể cả project import sau.
- Badge farm ở màn Nguyên liệu cũng bấm được để tick/bỏ tick nhanh cho map hiện tại.

## Mục "Chưa phân loại"
- Item không có trong database hiện ở mục riêng, có icon thay thế (ô màu + chữ cái đầu).
- Người dùng gán ngay trong app: chọn nhóm có sẵn hoặc tạo nhóm mới, chọn farm hoặc "không farm được" + ghi cách kiếm, tùy chọn tên Việt và max stack. Lưu vào `database\` (file override của người dùng) để lần sau tự nhận ra.

## Cài đặt
- Ngôn ngữ hiển thị: English / Tiếng Việt / Duo (EN tên chính, VI dòng nhỏ bên dưới như mockup). Áp dụng cho tên item, tên nhóm, giao diện. Tên item lấy chính xác từ en_us.json / vi_vn.json của Minecraft 1.21.11. "farm" không bao giờ dịch.
- Theme: A · Cozy Cabin (sáng, gỗ ấm + giấy kem, tiêu đề chữ pixel), B · Campfire Night (tối, nâu + cam lửa), C · Meadow Pastel (xanh cỏ nhạt, chữ tròn). Theo đúng 3 mockup.
- Sao lưu: xuất toàn bộ (maps + projects + override) thành 1 file .json, nhập lại từ file đó. Mở folder dữ liệu.

## Thao tác project
- Đổi tên, đổi map, nhân bản, xóa (có xác nhận), reset trạng thái về Chưa có.
- Sidebar hiện % tiến độ = số loại Đã đủ / tổng loại.

## Icon
- Mọi item có icon PHẲNG (2D) pixel-art, phóng to bằng nearest-neighbor (không mờ). Item có texture riêng trong túi đồ (door, sign, bucket, flower pot, sea pickle…) dùng texture item; block dùng texture mặt chính của block gốc (stairs/slab/wall/fence dùng texture của block gốc). Texture animation (dải dọc) chỉ lấy frame đầu.
- Item thiếu icon: ô màu + chữ cái đầu, không bao giờ hiện ảnh vỡ.
- Ô icon có viền kiểu ô inventory Minecraft (theme C bo tròn).

## Không làm
- Không đọc save game, không mod, không kết nối Minecraft, không cập nhật realtime.
- Không mobile, không tài khoản, không cloud.
- Không dùng cột Missing/Available, không gộp khi import lại.

## Tiêu chí chấp nhận
1. Chọn file mẫu `docs/sample/material_list_2026-11-24_18.52.58.txt` → tạo project "AdventureTimeTreeHouse (Converted Sponge)". Mọi dòng đều có mặt (đếm khớp số dòng dữ liệu của file), mọi item có icon và nằm đúng nhóm. Không item nào vào "Chưa phân loại" trừ item thực sự không biết. Chấp nhận ngôn ngữ anh và việt
2. Lime Wool nằm trong nhóm Wool, badge Sheep Farm. Spruce Stairs/Trapdoor/Sign/Door/Slab/Fence/Planks/Stripped Spruce Wood chung nhóm Spruce, badge Tree Farm (Spruce). Black/Lime/Red/Green Concrete chung nhóm Concrete. Các item Deepslate chung nhóm Deepslate, nằm ở Không farm được.
3. Đặt Stripped Spruce Wood = Đang thu thập, nhập 3 520 → hàng mở rộng, đổi màu, hiện 10 656 Spruce Log cần, còn thiếu 5 964. Nhập 7 992 → tự chuyển Đã đủ và xuống khu dưới.
4. Đóng app, mở lại → mọi trạng thái, số đã gom, project đang chọn, sắp xếp, ngôn ngữ, theme còn nguyên.
5. Tạo project thứ 2 cùng map, tick "Tree Farm (Spruce)" ở tab Map → cả 2 project hiện "✔ đã có". Project ở map khác không hiện.
6. Đổi ngôn ngữ sang Việt → "Lime Wool" hiện đúng tên trong vi_vn.json. Tìm "len" ra các item wool.
7. Copy cả folder app sang đường dẫn khác → chạy được, dữ liệu đi theo.
8. Thu cửa sổ còn 1024×640 → không vỡ bố cục, không cuộn ngang.
```

---

## 3. `/speckit.clarify`

Chạy để Spec Kit tự hỏi thêm. Các điểm đã chốt, nếu nó hỏi lại thì trả lời theo đây:
- Java 1.21.11, có thể nâng bản sau.
- Import chỉ qua nút chọn file, mỗi lần import là 1 project mới, bỏ Missing/Available.
- Nguyên liệu thô của từng item chỉ hiện khi Đang thu thập. Tổng nhóm thu gọn, bấm header nhóm để mở.
- Theme: cả 3 (A/B/C), đổi trong Cài đặt.
- Farm đã có lưu theo map.

---

## 4. `/speckit.plan`

```
Kế hoạch kỹ thuật:

## Stack
- Tauri 2 (Rust) + React 18 + TypeScript (strict) + Vite. Lý do: dùng WebView2 có sẵn trên Windows 10/11, exe ~10 MB, RAM thấp, chạy portable.
- Build exe portable, không installer: `MTR Check list.exe` đặt ở gốc `D:\App\MTR Check list by NguyenFinn\`. Tắt updater. Tauri dùng đường dẫn cạnh exe (`std::env::current_exe().parent()`) cho mọi dữ liệu, KHÔNG dùng AppData. Riêng thư mục profile WebView2 cũng trỏ vào `data\.webview` để portable thật sự.
- State: Zustand. Style: CSS thuần với CSS variables cho 3 theme (lấy token từ `docs/mockups/mockup.html`). Font Nunito + Pixelify Sans đóng gói local (woff2) dưới `src/assets/fonts`.
- Test: Vitest cho logic thuần. Không thêm thư viện UI nặng.
- Lệnh Rust tối thiểu: read_json, write_json_atomic, list_dir, pick_file (tauri-plugin-dialog), copy_file, open_folder. Mọi path được kiểm tra nằm trong folder app.

## Cấu trúc folder cuối cùng
D:\App\MTR Check list by NguyenFinn\
├─ MTR Check list.exe
├─ data\
│  ├─ app.json          ← settings: ngôn ngữ, theme, sort, project đang mở
│  ├─ maps.json         ← [{id, name, ownedFarmIds[]}]
│  ├─ projects\<id>.json← {id, name, schematic, mapId, createdAt, updatedAt, items:[{itemId|rawName, total, status, collected}]}
│  ├─ imports\          ← bản gốc .txt
│  └─ backups\          ← tự backup mỗi lần lưu, giữ 10 bản/ file
├─ database\
│  ├─ items.json        ← {id, en, vi, maxStack, groupId, icon}
│  ├─ groups.json       ← {id, en, vi, farmIds[], baseItems[], howTo:{en,vi}}
│  ├─ farms.json        ← {id, en, vi, produces[], note}
│  ├─ recipes.json      ← công thức rút gọn đã chọn để tính nguyên liệu thô
│  └─ user_overrides.json ← gán thêm của người dùng (Chưa phân loại)
├─ icons\<item_id>.png
└─ _source\             ← code, .specify, scripts, docs, mc-assets

## Pipeline dữ liệu (scripts Node trong _source\scripts, chạy khi build hoặc nâng version)
1. `prepare-assets`: từ `D:\App\MTR Check list by NguyenFinn\26.3.x-Template` (resource pack template vanilla), copy phần cần (`assets/minecraft/{items,models,blockstates,textures/block,textures/item,lang/en_us.json}`) vào `_source\mc-assets\`, rồi XÓA folder template gốc (sau khi xác nhận copy đủ). Bỏ shaders, font, particle, entity, gui, environment… Thêm `vi_vn.json` lấy từ asset index Modrinth (`%APPDATA%\ModrinthApp\meta\assets\indexes\29.json` → objects/minecraft/lang/vi_vn.json; chọn index khớp 1.21.11).
2. `build-icons`: với mỗi item, đọc `items/<id>.json` → model → texture: ưu tiên `layer0` (item phẳng); với block model lấy theo thứ tự `side`/`all`/`texture`/`end`/`top`, stairs/slab/wall/fence/button/pressure plate dùng texture của block gốc. Crop frame đầu với texture animation (cao > rộng). Phóng 16→64 px nearest-neighbor, xuất `icons\<id>.png`. Ghi báo cáo item thiếu icon.
3. `build-recipes`: giải nén `data/minecraft/recipe/*.json` từ jar 1.21.11 (`%APPDATA%\ModrinthApp\meta\versions\1.21.11-0.18.6\1.21.11-0.18.6.jar`). Với mỗi item, chọn công thức để tính nguyên liệu thô theo thứ tự ưu tiên: stonecutter (1:1, hiệu quả nhất cho đá) > crafting shaped/shapeless > smelting. Dừng ở nguyên liệu gốc của nhóm (log, sand, gravel, wool, dye, cobblestone…). Ví dụ: 4 Spruce Log → 3 Stripped Spruce Wood (qua Spruce Wood + strip), 1 log → 4 planks, 6 planks → 4 stairs, 3 planks → 6 slab, sand 4 + gravel 4 + dye 1 → 8 concrete powder → concrete (nước).
4. `build-items`: ghép id + tên en/vi + maxStack (từ dữ liệu item của jar) + icon.
5. `groups.json` và `farms.json` VIẾT TAY (dữ liệu biên soạn), phủ toàn bộ block/item survival 1.21.11. Tối thiểu phải phủ mọi item trong file mẫu. Mỗi farm ghi tên chuẩn cộng đồng (EN), bản VI giữ chữ "farm" (vd "Sheep Farm (len)" → VI "Sheep farm (len)"). Item không farm được có howTo ngắn.
6. Script `validate-db`: báo item không thuộc nhóm nào, nhóm không có farm/howTo, id icon thiếu.

## Logic thuần (src/core, có unit test)
- `parseLitematica(text)`: đọc tên schematic + các dòng `| name | total | missing | available |`, bỏ header/separator lặp lại cuối file, chịu được CRLF/LF, khoảng trắng thừa, số có dấu phân cách.
- `resolveItemId(name)`: tra ngược en_us (block.minecraft.* rồi item.minecraft.*), không phân biệt hoa thường, cộng thêm user_overrides. Không thấy → unclassified.
- `rawMaterials(itemId, qty)`: duyệt cây công thức, làm tròn lên theo số lần craft ở từng bước, trả về map nguyên liệu gốc → số lượng. `rawMissing` = rawMaterials(total − collected).
- `groupTotals(project, groupId)`: tổng raw cả nhóm và phần còn thiếu.
- `partition(project, db, map)`: → {missing:{farmable:Group[], nonFarmable:Group[], unclassified}, owned:{…}}.
- `sortGroups(groups, mode, reverse, ownedFarms)`: theo quy tắc trong spec.
- `formatQty(n, maxStack)`: "124 stack + 56 · 4.6 shulker" (shulker = 27 × maxStack).

## UI (src/ui)
- Theo mockup: Sidebar, Header, Toolbar, Zone, GroupCard (header bấm được → mở dòng tổng nhóm), ItemRow (3 nút trạng thái; mở rộng khi Đang thu thập), OwnedBar (thu gọn được), MapFarmTab, SettingsTab, UnclassifiedPanel, ImportDialog (tên + chọn map).
- Danh sách dài thì virtualize mỗi nhóm (> 60 hàng) để giữ mượt.
- Bố cục co giãn: 2 cột thẻ nhóm khi rộng ≥ 1400 px, 1 cột khi hẹp hơn. Sidebar thu gọn được khi < 1200 px.
- Accessibility cơ bản: nút có focus ring, ô số dùng bàn phím (↑/↓, Shift = ±64).

## Phát hành
- `npm run tauri build` → copy exe ra gốc folder app. Script `release.ps1` dọn build tạm, chỉ để lại exe + data + database + icons + _source.
- README ngắn (VI) ở gốc: cách dùng, cách nâng version Minecraft (thay mc-assets + jar → chạy scripts).
```

---

## 5. `/speckit.tasks` và `/speckit.implement`

Chạy bình thường. Yêu cầu thêm khi chạy implement:
- Làm theo thứ tự: scripts dữ liệu → core + test → UI → đóng gói.
- Sau mỗi giai đoạn chạy test và chụp ảnh màn hình UI so với mockup.
- Không xóa `26.3.x-Template` trước khi `_source\mc-assets` đã được kiểm tra đủ file.
