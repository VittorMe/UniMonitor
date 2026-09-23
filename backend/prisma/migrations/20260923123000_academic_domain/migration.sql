-- AlterEnum em tres passos: MySQL recusa remover valores ainda presentes nas linhas.
ALTER TABLE `users` MODIFY `role` ENUM('ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER', 'PROFESSOR', 'MONITOR', 'STUDENT') NOT NULL DEFAULT 'STUDENT';
UPDATE `users` SET `role` = 'STUDENT' WHERE `role` IN ('MANAGER', 'OPERATOR', 'VIEWER');
ALTER TABLE `users` MODIFY `role` ENUM('ADMIN', 'PROFESSOR', 'MONITOR', 'STUDENT') NOT NULL DEFAULT 'STUDENT';

-- CreateTable
CREATE TABLE `courses` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `courses_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjects` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `courseId` CHAR(36) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subjects_code_key`(`code`),
    INDEX `subjects_courseId_idx`(`courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `professors` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `registration` VARCHAR(40) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `professors_userId_key`(`userId`),
    UNIQUE INDEX `professors_registration_key`(`registration`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `courseId` CHAR(36) NOT NULL,
    `registration` VARCHAR(40) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `students_userId_key`(`userId`),
    UNIQUE INDEX `students_registration_key`(`registration`),
    INDEX `students_courseId_idx`(`courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `monitors` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `studentId` CHAR(36) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `monitors_userId_key`(`userId`),
    UNIQUE INDEX `monitors_studentId_key`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `professor_subjects` (
    `id` CHAR(36) NOT NULL,
    `professorId` CHAR(36) NOT NULL,
    `subjectId` CHAR(36) NOT NULL,
    `year` INTEGER NOT NULL,
    `semester` TINYINT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `professor_subjects_subjectId_year_semester_idx`(`subjectId`, `year`, `semester`),
    UNIQUE INDEX `professor_subjects_professorId_subjectId_year_semester_key`(`professorId`, `subjectId`, `year`, `semester`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subject_monitors` (
    `id` CHAR(36) NOT NULL,
    `subjectId` CHAR(36) NOT NULL,
    `monitorId` CHAR(36) NOT NULL,
    `professorId` CHAR(36) NOT NULL,
    `year` INTEGER NOT NULL,
    `semester` TINYINT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `approvedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `subject_monitors_subjectId_year_semester_idx`(`subjectId`, `year`, `semester`),
    INDEX `subject_monitors_professorId_idx`(`professorId`),
    UNIQUE INDEX `subject_monitors_monitorId_subjectId_year_semester_key`(`monitorId`, `subjectId`, `year`, `semester`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rooms` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `building` VARCHAR(80) NOT NULL,
    `floor` VARCHAR(40) NOT NULL,
    `capacity` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `monitor_availabilities` (
    `id` CHAR(36) NOT NULL,
    `subjectMonitorId` CHAR(36) NOT NULL,
    `weekday` TINYINT NOT NULL,
    `startTime` VARCHAR(5) NOT NULL,
    `endTime` VARCHAR(5) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `topic` VARCHAR(160) NULL,
    `type` ENUM('PRIVATE', 'GROUP', 'OFFICE_HOURS', 'STUDY_GROUP') NOT NULL DEFAULT 'OFFICE_HOURS',
    `modality` ENUM('PRESENTIAL', 'ONLINE', 'HYBRID') NOT NULL DEFAULT 'PRESENTIAL',
    `maxParticipants` INTEGER NOT NULL,
    `roomId` CHAR(36) NULL,
    `meetingUrl` VARCHAR(500) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `monitor_availabilities_subjectMonitorId_idx`(`subjectMonitorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `monitoring_sessions` (
    `id` CHAR(36) NOT NULL,
    `subjectMonitorId` CHAR(36) NOT NULL,
    `type` ENUM('PRIVATE', 'GROUP', 'OFFICE_HOURS', 'STUDY_GROUP') NOT NULL,
    `modality` ENUM('PRESENTIAL', 'ONLINE', 'HYBRID') NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `description` VARCHAR(2000) NULL,
    `topic` VARCHAR(160) NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `maxParticipants` INTEGER NOT NULL,
    `roomId` CHAR(36) NULL,
    `meetingUrl` VARCHAR(500) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PUBLISHED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `monitoring_sessions_subjectMonitorId_idx`(`subjectMonitorId`),
    INDEX `monitoring_sessions_startAt_endAt_idx`(`startAt`, `endAt`),
    INDEX `monitoring_sessions_status_idx`(`status`),
    INDEX `monitoring_sessions_roomId_idx`(`roomId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_participants` (
    `id` CHAR(36) NOT NULL,
    `sessionId` CHAR(36) NOT NULL,
    `studentId` CHAR(36) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'ATTENDED', 'ABSENT') NOT NULL DEFAULT 'PENDING',
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmedAt` DATETIME(3) NULL,
    `attendedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,

    INDEX `session_participants_studentId_idx`(`studentId`),
    INDEX `session_participants_status_idx`(`status`),
    UNIQUE INDEX `session_participants_sessionId_studentId_key`(`sessionId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` CHAR(36) NOT NULL,
    `sessionId` CHAR(36) NOT NULL,
    `studentId` CHAR(36) NOT NULL,
    `monitorId` CHAR(36) NOT NULL,
    `rating` TINYINT NOT NULL,
    `comment` VARCHAR(1000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reviews_monitorId_idx`(`monitorId`),
    UNIQUE INDEX `reviews_sessionId_studentId_key`(`sessionId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `type` ENUM('REQUEST_ACCEPTED', 'REQUEST_REJECTED', 'SESSION_REMINDER', 'SESSION_UPDATED', 'SESSION_CANCELLED', 'NEW_REVIEW', 'MONITOR_ASSIGNED', 'GENERIC') NOT NULL DEFAULT 'GENERIC',
    `title` VARCHAR(160) NOT NULL,
    `message` VARCHAR(500) NOT NULL,
    `link` VARCHAR(255) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_readAt_idx`(`userId`, `readAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `professors` ADD CONSTRAINT `professors_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monitors` ADD CONSTRAINT `monitors_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monitors` ADD CONSTRAINT `monitors_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `professor_subjects` ADD CONSTRAINT `professor_subjects_professorId_fkey` FOREIGN KEY (`professorId`) REFERENCES `professors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `professor_subjects` ADD CONSTRAINT `professor_subjects_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subject_monitors` ADD CONSTRAINT `subject_monitors_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subject_monitors` ADD CONSTRAINT `subject_monitors_monitorId_fkey` FOREIGN KEY (`monitorId`) REFERENCES `monitors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subject_monitors` ADD CONSTRAINT `subject_monitors_professorId_fkey` FOREIGN KEY (`professorId`) REFERENCES `professors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monitor_availabilities` ADD CONSTRAINT `monitor_availabilities_subjectMonitorId_fkey` FOREIGN KEY (`subjectMonitorId`) REFERENCES `subject_monitors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monitoring_sessions` ADD CONSTRAINT `monitoring_sessions_subjectMonitorId_fkey` FOREIGN KEY (`subjectMonitorId`) REFERENCES `subject_monitors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monitoring_sessions` ADD CONSTRAINT `monitoring_sessions_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_participants` ADD CONSTRAINT `session_participants_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `monitoring_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_participants` ADD CONSTRAINT `session_participants_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `monitoring_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_monitorId_fkey` FOREIGN KEY (`monitorId`) REFERENCES `monitors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
