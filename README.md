# 🌟 NeonTabs (Universal Client-Side Counter App)

**NeonTabs** เป็นเว็บแอปพลิเคชันประเภท Progressive Web App (PWA) ที่ออกแบบมาเพื่อการนับแต้มและติดตามข้อมูลต่างๆ แบบออฟไลน์ 100% (Client-side No Backend) เน้นความเป็นส่วนตัวสูงสุด (Privacy-first) และดีไซน์แบบ High-Contrast Dark Mode ตัดกับแสงไฟนีออนเรืองแสง เหมาะสำหรับทั้งการใช้งานทั่วไป, เล่นกีฬา, นับสถิติ หรือทำกิจกรรมต่างๆ

---

## 🚀 ฟีเจอร์เด่น (Key Features)

1. **100% Client-Side & Privacy-First**
   - ประมวลผลและจัดเก็บข้อมูลทั้งหมดลงในเบราว์เซอร์ผ่าน `localStorage` ปลอดภัย ไม่มีข้อมูลถูกส่งขึ้นเซิร์ฟเวอร์
2. **Progressive Web App (PWA) & Offline-First**
   - รองรับการติดตั้งลงบนหน้าจอโฮม (Home Screen) ของสมาร์ทโฟนและทำงานแบบ Offline ได้อย่างสมบูรณ์ผ่าน Service Worker (`sw.js`)
3. **หลากหลายรูปแบบการนับ (Counter Types)**
   - **Single Counter:** นับเดี่ยวทั่วไป พร้อมตั้งเป้าหมาย (Goal) และขีดจำกัด (Limit) แจ้งเตือนสีเขียว/แดงอัตโนมัติ
   - **Dual Counter:** นับคู่แยก 2 ฝั่ง (เช่น ทีม A vs ทีม B) พร้อมเปิดโหมด Arena เต็มจอ
   - **Dynamic Multi-Counter:** นับกลุ่มที่สามารถเพิ่มจำนวนทีมหรือผู้เล่นได้อย่างอิสระ
4. **Focus / Arena Mode**
   - หน้าจอพิเศษแบบ Full-Screen Split-Screen ซ่อนเมนูรกตา แสดงตัวเลขขนาดมโหฬาร เหมาะสำหรับใช้บนสนามแข่งกีฬาหรือกิจกรรมที่ต้องมองเห็นชัดเจนระยะไกล
5. **ระบบรีเซ็ตอัตโนมัติ (Auto-Reset Schedule)**
   - ตั้งเวลารีเซ็ตค่ากลับเป็น 0 อัตโนมัติ (รายวัน, รายสัปดาห์, รายเดือน, รายปี)
6. **ระบบอำนวยความสะดวก (Utility Features)**
   - **Undo Snackbar:** แถบเลิกทำ (Undo) ย้อนกลับการกดพลาดภายใน 4 วินาที
   - **Haptic Feedback:** สั่นเตือนสั้นๆ เมื่อกดปุ่ม (ผ่าน Web Vibration API)
   - **Wake Lock API:** ป้องกันหน้าจอดับขณะเปิดใช้งาน
   - **Data Center:** สำรองข้อมูลด้วยการส่งออก (`Export .json`) และกู้คืนข้อมูล (`Import .json`)

---

## 📁 โครงสร้างไฟล์ในโฟลเดอร์ `NeonTabs`

```text
NeonTabs/
├── index.html       # ไฟล์หน้าเว็บหลัก Single Page Application (SPA) พร้อม Tailwind CSS
├── app.js           # โลจิกการทำงานทั้งหมดของแอป (State, LocalStorage, Auto-Reset, Events)
├── manifest.json    # PWA Manifest สำหรับติดตั้งแอปบนมือถือ
├── sw.js            # Service Worker สำหรับรองรับการใช้งานแบบ Offline
└── README.md        # คู่มือการใช้งานและเอกสารประกอบโปรเจกต์
```

---

## 🛠️ วิธีการใช้งานและการติดตั้ง (Getting Started)

1. **เปิดใช้งานผ่าน Static Server:**
   คุณสามารถรันเว็บเซิร์ฟเวอร์แบบง่ายๆ ในโฟลเดอร์ `NeonTabs` เช่น:
   ```bash
   npx http-server NeonTabs -p 5100
   ```
   หรือเปิดไฟล์ `NeonTabs/index.html` ผ่านเบราว์เซอร์ได้โดยตรง

2. **การติดตั้งบนมือถือ (PWA):**
   - เปิดเว็บไซต์ผ่านเบราว์เซอร์มือถือ (เช่น Chrome บน Android หรือ Safari บน iOS)
   - เลือกเมนู **"เพิ่มลงในหน้าจอหลัก" (Add to Home Screen)**
   - สามารถใช้งานได้เหมือนแอปพลิเคชันทั่วไปและทำงานแบบออฟไลน์ได้ทันที!
