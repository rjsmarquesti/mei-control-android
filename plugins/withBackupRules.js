const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

// Android 12+ usa data-extraction-rules (targetSdkVersion 35 no Expo SDK 56)
const BACKUP_RULES = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <include domain="database" path="MeiControlKit.db"/>
    <exclude domain="sharedpref" path="activated"/>
  </cloud-backup>
  <device-transfer>
    <include domain="database" path="MeiControlKit.db"/>
    <exclude domain="sharedpref" path="activated"/>
  </device-transfer>
</data-extraction-rules>`

module.exports = function withBackupRules(config) {
  // 1. Cria backup_rules.xml em res/xml (callback síncrono — obrigatório no EAS Build)
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/res/xml'
      )
      fs.mkdirSync(xmlDir, { recursive: true })
      fs.writeFileSync(path.join(xmlDir, 'backup_rules.xml'), BACKUP_RULES)
      return config
    },
  ])

  // 2. Injeta atributos no AndroidManifest (formato Android 12+)
  config = withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0]
    app.$['android:allowBackup'] = 'true'
    app.$['android:dataExtractionRules'] = '@xml/backup_rules'
    // Mantém fullBackupContent para compatibilidade com Android < 12
    app.$['android:fullBackupContent'] = '@xml/backup_rules'
    return config
  })

  return config
}
