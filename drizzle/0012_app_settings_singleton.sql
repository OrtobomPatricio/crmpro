ALTER TABLE app_settings
  ADD COLUMN singleton TINYINT NOT NULL DEFAULT 1;

-- deja todo en 1
UPDATE app_settings SET singleton = 1;

-- si hay duplicados, quedate con el id mas chico
DELETE s1 FROM app_settings s1
JOIN app_settings s2
  ON s1.singleton = s2.singleton
 AND s1.id > s2.id;

CREATE UNIQUE INDEX uniq_app_settings_singleton ON app_settings(singleton);
