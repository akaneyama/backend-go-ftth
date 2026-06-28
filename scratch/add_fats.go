// GetClientFats mengambil daftar area FAT beserta jumlah pelanggannya
func GetClientFats(c *fiber.Ctx) error {
	var fats []struct {
		Fat   string `json:"fat"`
		Count int    `json:"count"`
	}

	// Mengambil semua FAT beserta jumlahnya (termasuk yang jumlahnya 0 jika memungkinkan, namun dengan join sederhana kita ambil yang ada saja)
	query := `
		SELECT fat, COUNT(client_id) as count 
		FROM clients 
		WHERE fat != '' AND deleted_at IS NULL 
		GROUP BY fat
		
		UNION
		
		SELECT name as fat, 0 as count
		FROM network_nodes
		WHERE type = 'ODP' AND name NOT IN (
			SELECT fat FROM clients WHERE fat != '' AND deleted_at IS NULL
		)
		ORDER BY fat ASC
	`

	if err := config.DB.Raw(query).Scan(&fats).Error; err != nil {
		return utils.Error(c, "Gagal memuat data FAT: "+err.Error())
	}

	return utils.Success(c, "Berhasil memuat daftar FAT", fats)
}
