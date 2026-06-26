-- ============================================================
-- 001_reference_tables.sql
-- Shared reference data: wilayas and communes (Algeria)
-- Not tenant-scoped — shared across all tenants
-- ============================================================

CREATE TABLE wilayas (
  id   SMALLINT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10)  NOT NULL UNIQUE
);

CREATE TABLE communes (
  id        SERIAL PRIMARY KEY,
  wilaya_id SMALLINT     NOT NULL REFERENCES wilayas(id),
  name      VARCHAR(100) NOT NULL
);

CREATE INDEX idx_communes_wilaya ON communes(wilaya_id);

-- ── Seed: 58 wilayas ────────────────────────────────────────
INSERT INTO wilayas (id, name, code) VALUES
(1,  'Adrar',               'ADR'),
(2,  'Chlef',               'CHL'),
(3,  'Laghouat',            'LAG'),
(4,  'Oum El Bouaghi',      'OEB'),
(5,  'Batna',               'BAT'),
(6,  'Bejaia',              'BEJ'),
(7,  'Biskra',              'BIS'),
(8,  'Bechar',              'BEC'),
(9,  'Blida',               'BLD'),
(10, 'Bouira',              'BOU'),
(11, 'Tamanrasset',         'TAM'),
(12, 'Tebessa',             'TEB'),
(13, 'Tlemcen',             'TLC'),
(14, 'Tiaret',              'TIA'),
(15, 'Tizi Ouzou',          'TZO'),
(16, 'Alger',               'ALG'),
(17, 'Djelfa',              'DJE'),
(18, 'Jijel',               'JIJ'),
(19, 'Setif',               'SET'),
(20, 'Saida',               'SAI'),
(21, 'Skikda',              'SKI'),
(22, 'Sidi Bel Abbes',      'SBA'),
(23, 'Annaba',              'ANN'),
(24, 'Guelma',              'GUE'),
(25, 'Constantine',         'CON'),
(26, 'Medea',               'MED'),
(27, 'Mostaganem',          'MOS'),
(28, 'M''Sila',              'MSI'),
(29, 'Mascara',             'MAS'),
(30, 'Ouargla',             'OUA'),
(31, 'Oran',                'ORA'),
(32, 'El Bayadh',           'ELB'),
(33, 'Illizi',              'ILL'),
(34, 'Bordj Bou Arreridj',  'BBA'),
(35, 'Boumerdes',           'BMD'),
(36, 'El Tarf',             'ELT'),
(37, 'Tindouf',             'TIN'),
(38, 'Tissemsilt',          'TIS'),
(39, 'El Oued',             'ELO'),
(40, 'Khenchela',           'KHE'),
(41, 'Souk Ahras',          'SOA'),
(42, 'Tipaza',              'TIP'),
(43, 'Mila',                'MIL'),
(44, 'Ain Defla',           'AID'),
(45, 'Naama',               'NAA'),
(46, 'Ain Temouchent',      'AIT'),
(47, 'Ghardaia',            'GHA'),
(48, 'Relizane',            'REL'),
(49, 'Timimoun',            'TMM'),
(50, 'Bordj Badji Mokhtar', 'BBM'),
(51, 'Ouled Djellal',       'ODJ'),
(52, 'Beni Abbes',          'BNA'),
(53, 'In Salah',            'INS'),
(54, 'In Guezzam',          'ING'),
(55, 'Touggourt',           'TOU'),
(56, 'Djanet',              'DJA'),
(57, 'El M''Ghair',          'EMG'),
(58, 'El Meniaa',           'EMN');
