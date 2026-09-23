-- CreateTable
CREATE TABLE `subject_courses` (
    `subjectId` CHAR(36) NOT NULL,
    `courseId` CHAR(36) NOT NULL,

    INDEX `subject_courses_courseId_idx`(`courseId`),
    PRIMARY KEY (`subjectId`, `courseId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- MigrateData
INSERT INTO `subject_courses` (`subjectId`, `courseId`)
SELECT `id`, `courseId` FROM `subjects`;

-- AddForeignKey
ALTER TABLE `subject_courses` ADD CONSTRAINT `subject_courses_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subject_courses` ADD CONSTRAINT `subject_courses_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE `subjects` DROP FOREIGN KEY `subjects_courseId_fkey`;

-- DropIndex
DROP INDEX `subjects_courseId_idx` ON `subjects`;

-- AlterTable
ALTER TABLE `subjects` DROP COLUMN `courseId`;
