-- Create the database
CREATE DATABASE IF NOT EXISTS million_grids
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE million_grids;

-- Create the cells table (stores active cells only for efficiency)
CREATE TABLE IF NOT EXISTS pixels (
    x INT NOT NULL,
    y INT NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (x, y)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index for finding all active cells quickly
CREATE INDEX idx_pixels_active ON pixels(active) WHERE active = 1;
