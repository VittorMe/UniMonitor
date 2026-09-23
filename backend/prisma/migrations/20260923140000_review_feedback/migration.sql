-- AlterTable
ALTER TABLE `reviews`
  ADD COLUMN `clarity` TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN `punctuality` TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN `mastery` TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN `isAnonymous` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `publishComment` BOOLEAN NOT NULL DEFAULT true;

UPDATE `reviews`
SET
  `clarity` = `rating`,
  `punctuality` = `rating`,
  `mastery` = `rating`;
