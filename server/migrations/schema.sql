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
    color VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
    created_by VARCHAR(45) NULL,
    modify_at DATETIME NULL,
    modify_by VARCHAR(45) NULL,
    PRIMARY KEY (x, y)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index for finding all active cells quickly
CREATE INDEX idx_pixels_active ON pixels(active) WHERE active = 1;

-- Index for finding cells by creator
CREATE INDEX idx_pixels_created_by ON pixels(created_by);

-- Index for finding cells by modifier
CREATE INDEX idx_pixels_modify_by ON pixels(modify_by);
