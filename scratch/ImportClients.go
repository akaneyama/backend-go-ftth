// ImportClients mengimpor data pelanggan dari Excel secara massal
func ImportClients(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)

	file, err := c.FormFile("excel_file")
	if err != nil {
		return utils.Failed(c, "Tidak ada file excel yang dipilih.")
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".xlsx" && ext != ".xls" {
		return utils.Failed(c, "Format file tidak valid. Unggah file Excel (.xlsx atau .xls).")
	}

	src, err := file.Open()
	if err != nil {
		return utils.Failed(c, "Gagal membuka file unggahan.")
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return utils.Failed(c, "Gagal membaca isi berkas unggahan.")
	}

	xlFile, err := excelize.OpenReader(strings.NewReader(string(fileBytes)))
	if err != nil {
		return utils.Failed(c, "Format Excel rusak: "+err.Error())
	}
	defer xlFile.Close()

	// Ambil sheet pertama
	sheetName := xlFile.GetSheetName(0)
	rows, err := xlFile.GetRows(sheetName)
	if err != nil || len(rows) < 2 {
		return utils.Failed(c, "Data Excel kosong atau tidak memiliki baris data.")
	}

	// Indeks Kolom Cerdas (Berdasarkan Header)
	colMap := map[string]int{
		"nama":           -1,
		"phone":          -1,
		"alamat":         -1,
		"fat":            -1,
		"paket":          -1,
		"router_id":      -1,
		"latitude":       -1,
		"longitude":      -1,
		"ip_address":     -1,
		"onu_sn":         -1,
		"pppoe_username": -1,
		"pppoe_password": -1,
		"pppoe_profile":  -1,
		"sync_mikrotik":  -1,
	}

	headers := rows[0]
	for idx, h := range headers {
		lh := strings.ToLower(strings.TrimSpace(h))
		if strings.Contains(lh, "nama") || strings.Contains(lh, "client") {
			colMap["nama"] = idx
		} else if strings.Contains(lh, "telepon") || strings.Contains(lh, "phone") || strings.Contains(lh, "kontak") || strings.Contains(lh, "hp") {
			colMap["phone"] = idx
		} else if strings.Contains(lh, "alamat") || strings.Contains(lh, "rumah") || strings.Contains(lh, "address") {
			colMap["alamat"] = idx
		} else if strings.Contains(lh, "fat") || strings.Contains(lh, "area") || strings.Contains(lh, "box") || strings.Contains(lh, "odp") {
			colMap["fat"] = idx
		} else if strings.Contains(lh, "paket") || strings.Contains(lh, "packet") || strings.Contains(lh, "plan") || strings.Contains(lh, "internet") {
			colMap["paket"] = idx
		} else if strings.Contains(lh, "router id") || strings.Contains(lh, "router_id") || strings.Contains(lh, "ref") {
			colMap["router_id"] = idx
		} else if strings.Contains(lh, "lat") || strings.Contains(lh, "lintang") {
			colMap["latitude"] = idx
		} else if strings.Contains(lh, "long") || strings.Contains(lh, "bujur") {
			colMap["longitude"] = idx
		} else if strings.Contains(lh, "ip") {
			colMap["ip_address"] = idx
		} else if strings.Contains(lh, "sn") || strings.Contains(lh, "serial") {
			colMap["onu_sn"] = idx
		} else if strings.Contains(lh, "password") {
			colMap["pppoe_password"] = idx
		} else if strings.Contains(lh, "profile") {
			colMap["pppoe_profile"] = idx
		} else if strings.Contains(lh, "sync") || strings.Contains(lh, "mikrotik") {
			colMap["sync_mikrotik"] = idx
		} else if strings.Contains(lh, "pppoe") || strings.Contains(lh, "username") || strings.Contains(lh, "user") {
			colMap["pppoe_username"] = idx
		}
	}

	// Fallback map default jika tidak terdeteksi via nama
	if colMap["nama"] == -1 && len(headers) > 0 {
		colMap["nama"] = 0 
	}
	if colMap["phone"] == -1 && len(headers) > 1 {
		colMap["phone"] = 1
	}
	if colMap["alamat"] == -1 && len(headers) > 2 {
		colMap["alamat"] = 2
	}
	if colMap["fat"] == -1 && len(headers) > 3 {
		colMap["fat"] = 3
	}
	if colMap["paket"] == -1 && len(headers) > 4 {
		colMap["paket"] = 4
	}
	if colMap["router_id"] == -1 && len(headers) > 5 {
		colMap["router_id"] = 5
	}
	if colMap["latitude"] == -1 && len(headers) > 6 {
		colMap["latitude"] = 6
	}
	if colMap["longitude"] == -1 && len(headers) > 7 {
		colMap["longitude"] = 7
	}
	if colMap["ip_address"] == -1 && len(headers) > 8 {
		colMap["ip_address"] = 8
	}
	if colMap["onu_sn"] == -1 && len(headers) > 9 {
		colMap["onu_sn"] = 9
	}
	if colMap["pppoe_username"] == -1 && len(headers) > 10 {
		colMap["pppoe_username"] = 10
	}
	if colMap["pppoe_password"] == -1 && len(headers) > 11 {
		colMap["pppoe_password"] = 11
	}
	if colMap["pppoe_profile"] == -1 && len(headers) > 12 {
		colMap["pppoe_profile"] = 12
	}
	if colMap["sync_mikrotik"] == -1 && len(headers) > 13 {
		colMap["sync_mikrotik"] = 13
	}

	// Load all internet packages to easily map Excel values
	var packages []models.Internetpackage
	config.DB.Where("is_deleted = 0").Find(&packages)
	packageMap := make(map[string]int)
	for _, p := range packages {
		packageMap[strings.ToLower(strings.TrimSpace(p.PackageName))] = p.PackageID
	}

	type ParsedRow struct {
		Name            string  `json:"name"`
		Phone           string  `json:"phone"`
		Address         string  `json:"address"`
		FatVal          string  `json:"fat"`
		PaketVal        string  `json:"paket"`
		RouterID        string  `json:"router_id"`
		Latitude        float64 `json:"latitude"`
		Longitude       float64 `json:"longitude"`
		IpVal           string  `json:"ip_address"`
		SnVal           string  `json:"onu_sn"`
		PppoeVal        string  `json:"pppoe_username"`
		PppoePassVal    string  `json:"pppoe_password"`
		PppoeProfileVal string  `json:"pppoe_profile"`
		ShouldSync      bool    `json:"sync_mikrotik"`
		PackageID       *int    `json:"-"`
	}

	var parsedRows []ParsedRow

	for rIdx := 1; rIdx < len(rows); rIdx++ {
		row := rows[rIdx]
		if len(row) == 0 || (colMap["nama"] < len(row) && strings.TrimSpace(row[colMap["nama"]]) == "") {
			continue // baris kosong, skip
		}

		name := ""
		if colMap["nama"] < len(row) {
			name = strings.TrimSpace(row[colMap["nama"]])
		}
		if name == "" {
			continue
		}

		phone := ""
		if colMap["phone"] < len(row) {
			phone = strings.TrimSpace(row[colMap["phone"]])
		}

		address := ""
		if colMap["alamat"] < len(row) {
			address = strings.TrimSpace(row[colMap["alamat"]])
		}

		fatVal := ""
		if colMap["fat"] < len(row) {
			fatVal = strings.TrimSpace(row[colMap["fat"]])
		}

		paketVal := ""
		if colMap["paket"] < len(row) {
			paketVal = strings.TrimSpace(row[colMap["paket"]])
		}

		routerID := ""
		if colMap["router_id"] < len(row) {
			routerID = strings.TrimSpace(row[colMap["router_id"]])
		}

		latitude := 0.0
		if colMap["latitude"] < len(row) {
			val := strings.TrimSpace(row[colMap["latitude"]])
			latitude, _ = strconv.ParseFloat(val, 64)
		}

		longitude := 0.0
		if colMap["longitude"] < len(row) {
			val := strings.TrimSpace(row[colMap["longitude"]])
			longitude, _ = strconv.ParseFloat(val, 64)
		}

		// Auto-correct coordinates if swapped (latitude must be between -90 and 90)
		if latitude < -90 || latitude > 90 {
			if longitude >= -90 && longitude <= 90 {
				latitude, longitude = longitude, latitude
			}
		}

		var packageID *int
		if paketVal != "" {
			pNameLower := strings.ToLower(paketVal)
			if val, found := packageMap[pNameLower]; found {
				packageID = &val
			} else {
				// Cari substring matching
				for name, id := range packageMap {
					if strings.Contains(pNameLower, name) || strings.Contains(name, pNameLower) {
						packageID = &id
						paketVal = name
						break
					}
				}
			}
		}

		ipVal := ""
		if colMap["ip_address"] != -1 && colMap["ip_address"] < len(row) {
			ipVal = strings.TrimSpace(row[colMap["ip_address"]])
		}

		snVal := ""
		if colMap["onu_sn"] != -1 && colMap["onu_sn"] < len(row) {
			snVal = strings.TrimSpace(row[colMap["onu_sn"]])
		}

		pppoeVal := ""
		if colMap["pppoe_username"] != -1 && colMap["pppoe_username"] < len(row) {
			pppoeVal = strings.TrimSpace(row[colMap["pppoe_username"]])
		}

		pppoePassVal := ""
		if colMap["pppoe_password"] != -1 && colMap["pppoe_password"] < len(row) {
			pppoePassVal = strings.TrimSpace(row[colMap["pppoe_password"]])
		}

		if pppoePassVal == "" {
			randBytes := make([]byte, 6)
			charset := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
			for i := range randBytes {
				randBytes[i] = charset[rand.Intn(len(charset))]
			}
			pppoePassVal = string(randBytes)
		}

		pppoeProfileVal := ""
		if colMap["pppoe_profile"] != -1 && colMap["pppoe_profile"] < len(row) {
			pppoeProfileVal = strings.TrimSpace(row[colMap["pppoe_profile"]])
		}
		if pppoeProfileVal == "" {
			pppoeProfileVal = "default"
		}

		syncVal := ""
		if colMap["sync_mikrotik"] != -1 && colMap["sync_mikrotik"] < len(row) {
			syncVal = strings.ToLower(strings.TrimSpace(row[colMap["sync_mikrotik"]]))
		}
		shouldSync := syncVal == "ya" || syncVal == "yes" || syncVal == "true" || syncVal == "1"

		parsedRows = append(parsedRows, ParsedRow{
			Name:            name,
			Phone:           phone,
			Address:         address,
			FatVal:          fatVal,
			PaketVal:        paketVal,
			RouterID:        routerID,
			Latitude:        latitude,
			Longitude:       longitude,
			IpVal:           ipVal,
			SnVal:           snVal,
			PppoeVal:        pppoeVal,
			PppoePassVal:    pppoePassVal,
			PppoeProfileVal: pppoeProfileVal,
			ShouldSync:      shouldSync,
			PackageID:       packageID,
		})
	}

	isPreview := c.FormValue("preview") == "true"
	if isPreview {
		return utils.Success(c, "Preview berhasil dimuat.", parsedRows)
	}

	var importedCount int

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		for _, pr := range parsedRows {
			// Validasi apakah Router ID ada di database
			routerID := pr.RouterID
			if routerID != "" {
				var router models.Router
				if err := tx.First(&router, "router_id = ?", routerID).Error; err != nil {
					routerID = "" // Kosongkan referensi jika router_id tidak valid
				}
			}

			// Cari IP Pool & localAddr (gateway) berdasarkan IP Address pelanggan
			localAddr := ""
			var ipPoolID *int
			if pr.IpVal != "" {
				var pools []models.IPPool
				tx.Find(&pools)
				for _, p := range pools {
					_, ipnet, _ := net.ParseCIDR(p.Subnet)
					ip := net.ParseIP(pr.IpVal)
					if ipnet != nil && ipnet.Contains(ip) {
						localAddr = p.Gateway
						poolIdCopy := p.ID
						ipPoolID = &poolIdCopy
						break
					}
				}
			}

			client := models.Client{
				Name:          pr.Name,
				Phone:         pr.Phone,
				Address:       pr.Address,
				Fat:           pr.FatVal,
				RouterID:      routerID,
				PackageID:     pr.PackageID,
				Latitude:      pr.Latitude,
				Longitude:     pr.Longitude,
				IPAddress:     pr.IpVal,
				IPPoolID:      ipPoolID,
				OnuSN:         pr.SnVal,
				PppoeUsername: pr.PppoeVal,
				PppoePassword: pr.PppoePassVal,
				PppoeProfile:  pr.PppoeProfileVal,
			}

			if err := tx.Create(&client).Error; err != nil {
				return err
			}

			// SINKRONKAN CRM -> MAP SECARA REAL-TIME PADA SAAT IMPORT EXCEL
			if pr.Latitude != 0 && pr.Longitude != 0 {
				node := models.NetworkNode{
					Name:        pr.Name,
					Type:        models.TypeClient,
					Latitude:    pr.Latitude,
					Longitude:   pr.Longitude,
					Description: pr.Address,
					Status:      "ONLINE",
				}
				if routerID != "" {
					parsedUUID, err := uuid.Parse(routerID)
					if err == nil {
						node.LinkedRouterID = &parsedUUID
					}
				}
				if err := tx.Create(&node).Error; err != nil {
					return err
				}

				clientNode := models.ClientNode{
					NodeID:        node.NodeID,
					SubscriberID:  strconv.Itoa(client.ClientID),
					PacketName:    pr.PaketVal,
					IPAddress:     pr.IpVal,
					OnuSN:         pr.SnVal,
					PppoeUsername: pr.PppoeVal,
				}
				if err := tx.Create(&clientNode).Error; err != nil {
					return err
				}
			}

			// SINKRONISASI MIKROTIK JIKA DIMINTA
			if pr.ShouldSync && pr.PppoeVal != "" && pr.PppoePassVal != "" && routerID != "" {
				var router models.Router
				if err := tx.First(&router, "router_id = ?", routerID).Error; err == nil {
					decryptedPass, _ := utils.DecryptAES(router.RouterPassword)

					errMikrotik := services.CreateOrUpdatePPPoESecret(
						router.RouterAddress,
						router.RouterPort,
						router.RouterUsername,
						decryptedPass,
						router.RouterRemoteType,
						pr.PppoeVal,
						pr.PppoePassVal,
						pr.PppoeProfileVal,
						pr.IpVal,
						localAddr,
					)
					if errMikrotik != nil {
						log.Println("Peringatan (Import): Gagal membuat PPPoE Secret di Mikrotik:", errMikrotik)
					}
				}
			}

			importedCount++
		}
		return nil
	})

	if err != nil {
		return utils.Error(c, "Gagal mengimpor pelanggan: "+err.Error())
	}

	utils.CreateLog(adminPelaku, "CLIENT", "INFO", fmt.Sprintf("Sukses mengimpor %d pelanggan dari file Excel", importedCount))
	return utils.Success(c, fmt.Sprintf("Berhasil mengimpor %d pelanggan.", importedCount), nil)
}
