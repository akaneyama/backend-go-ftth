# 🚀 FTTH Network Management System (NMS)

A robust, enterprise-grade, and aesthetically stunning full-stack application designed to orchestrate and manage Fiber-to-the-Home (FTTH) infrastructure. Built for modern internet service providers (ISPs) to automate provisioning, visualize network topologies, monitor real-time interface traffic, and integrate seamlessly with TR-069 Auto Configuration Servers (ACS) like GenieACS.

---

## ✨ Fitur Utama (Key Features)

### 🖥️ 1. Modern & Premium Dark-Sleek UI
* **Elegant Sidebar & Layout**: Dark theme (`slate-950`) with subtle neon glow active states (`sky-400`), smooth micro-animations, and dynamic avatar cards powered by `ui-avatars.com`.
* **Futuristic Login Screen**: Glassmorphic dark card overlay layout with background design, glowing connection visualizers, and polished responsive components.

### 🌐 2. Client & Area Provisioning
* **Hierarchical Topology Mapping**: Dynamic signal mapping from **Mikrotik Core Router ──► OLT Node ──► ODC Node ──► ODP Node (FAT)**.
* **Auto-Provisioning**: Automated calculation of topology and client mappings when assigning specific areas.
* **Advanced Client Fields**: Support for IP Addresses, ONTs Serial Numbers (SN), and optional PPPoE usernames.
* **Import & Export**: Seamless CSV template downloading and uploading for quick client migrations.

### 📊 3. Traffic & Interface Monitoring
* **Real-time Traffic Dashboards**: High-fidelity line charts built with Recharts displaying upload and download metrics.
* **Interface Synchronization**: Automatically pulls interface statistics directly from MikroTik RouterOS using periodic cron-like sync triggers.

### 🔌 4. TR-069 GenieACS Integration Ready
* **Optical Signal Diagnostics (Rx Power)**: Displays status indicators based on active optical signal strengths (e.g. Excellent `-15dBm` to Critical `>= -27dBm`).
* **Remote Control ONT**: One-click remote device rebooting through CWMP API actions directly from the dashboard.
* **Auto PPPoE Injector**: Automatic provisioning of PPPoE user credentials directly into customer ONTs via REST API.

---

## 🛠️ Stack Teknologi (Tech Stack)

| Komponen | Teknologi | Deskripsi |
| :--- | :--- | :--- |
| **Backend Core** | **Go (Golang)** | High-performance compiled language for backend execution. |
| **HTTP Framework**| **Go Fiber** | High-performance, low-memory Express-like web framework. |
| **Database ORM** | **GORM** | Clean object-relational mapping tool for database models. |
| **Database Storage**| **MySQL** | Reliable relational database for transaction & client logs. |
| **Mikrotik Driver**| **go-routeros** | Client connection library for MikroTik API RouterOS. |
| **Frontend Core** | **React & TypeScript**| Solid structure with static typing for resilient UI development. |
| **Bundler** | **Vite** | Lightning-fast asset compiler and modern dev server. |
| **Styling** | **Tailwind CSS** | Premium utility-first utility classes for absolute custom styling. |
| **Interactive Map** | **Leaflet & React-Leaflet** | Geospatial map representations of network ODP & active client nodes. |
| **Data Charts** | **Recharts** | Fully modular SVG representation layers for network graph traffic. |

---

## 📁 Struktur Proyek (Project Structure)

```text
├── ftth-be/              # BACKEND API (Go)
│   ├── controllers/      # Route controllers (Clients, Topology, Isolir, Users, etc.)
│   ├── models/           # GORM Database schemas & declarations
│   ├── routes/           # REST endpoints definition
│   ├── main.go           # Go application entrypoint
│   └── Dockerfile        # Container recipe for Backend deployment
│
├── ftth-fe/              # FRONTEND WEB APP (React & Vite)
│   ├── src/
│   │   ├── api/          # Axios instance & connection config
│   │   ├── components/   # Shared UI components (Charts, Motion, etc.)
│   │   ├── routers/      # Sidebar layout & main routing navigation
│   │   └── screens/      # Feature screens (Client, Router, ODP, Mapping, Traffic, etc.)
│   ├── index.html        # HTML shell entry point
│   ├── tailwind.config.js# Custom styling definitions
│   └── Dockerfile        # Container recipe for Frontend Nginx deployment
│
├── docker-compose.yml    # Combined Docker stack orchestration file
└── README.md             # Project documentation
```

---

## ⚙️ Panduan Instalasi (Setup Guidelines)

### 1. Kebutuhan Sistem (Prerequisites)
* **Go** versi 1.19 atau lebih baru
* **Node.js** versi 18 atau lebih baru (npm/yarn)
* **MySQL Database**
* **MikroTik RouterOS** (Akses API Port `8728` diaktifkan)
* **GenieACS Server** (Opsional - untuk manajemen TR-069)

---

### 2. Memulai Backend (Backend Setup)
1. Pindah ke direktori backend:
   ```bash
   cd ftth-be
   ```
2. Buat file `.env` baru berdasarkan `.env-example`:
   ```bash
   cp .env-example .env
   ```
3. Sesuaikan parameter konfigurasi database MySQL, API MikroTik, dan opsional GenieACS:
   ```env
   DB_USER=root
   DB_PASS=your_db_password
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=ftth_db

   JWT_SECRET=super_secret_jwt_key
   
   # GenieACS Config (Optional)
   GENIEACS_API_URL=http://your-genieacs:7557
   GENIEACS_USER=admin
   GENIEACS_PASSWORD=secret
   ```
4. Jalankan perintah instalasi dependency:
   ```bash
   go mod tidy
   ```
5. Mulai server backend:
   ```bash
   go run main.go
   ```

---

### 3. Memulai Frontend (Frontend Setup)
1. Pindah ke direktori frontend:
   ```bash
   cd ../ftth-fe
   ```
2. Pasang semua pustaka dependency:
   ```bash
   npm install
   ```
3. Sesuaikan target url API backend di file `.env`:
   ```env
   VITE_API_URL=http://localhost:8080
   ```
4. Jalankan server pembangunan lokal:
   ```bash
   npm run dev
   ```
5. Buka `http://localhost:5173` pada web browser Anda untuk masuk ke sistem.

---

### 4. Deploy Menggunakan Docker Compose (Production Stack)
Untuk menyatukan dan menyebarkan seluruh aplikasi secara cepat di server produksi:
```bash
docker-compose up --build -d
```
Docker Compose akan otomatis mengompilasi frontend React menggunakan Nginx, membangun backend Go, dan menyinkronkan koneksi database MySQL secara mandiri di dalam container terisolasi.

---

## 📄 Lisensi (License)
Proyek ini dilisensikan di bawah kepemilikan **Akaneyama FTTH Project**. Seluruh hak cipta dilindungi.
