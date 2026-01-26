'use strict';

/**
MediaUploader 

@class MediaUploader
@constructor
*/

class MediaUploader {
    DEFAULT_CHUNK_SIZE: number;
    terminated: boolean;
    
    constructor() {
        this.DEFAULT_CHUNK_SIZE = 1048576 * 2; // 2 MB
    }

    uploadFile(params) {

        let service = params.service;
        let chunkSize = this.DEFAULT_CHUNK_SIZE;
        if (service.CHUNK_SIZE)
            chunkSize = service.CHUNK_SIZE;

        let _this = this;

        return new Promise<any>(function (resolve, reject) {

            app.filesystem.getFileSizeAsync(params.sourcePath).then(function (fileSize) {

                if (service.maxFileSizeQuota && fileSize > service.maxFileSizeQuota) {
                    let s = 'File size quota exceeded (' + fileSize + ' > ' + service.maxFileSizeQuota + ')';
                    ODS(s);
                    reject(s);
                    return;
                }

                let uploadData : AnyDict = {
                    path: params.destinationPath,
                    sourcePath: params.sourcePath,
                    sessionURI: params.sessionURI, // optional
                    auth: params.auth, // optional
                    mimeType: 'application/octet-stream',
                    size: fileSize
                };

                let uploadFilePart = function (partNum) {

                    if (_this.terminated) {
                        reject('Upload was cancelled by user');
                        return;
                    }

                    let startOffset = partNum * chunkSize;
                    let endOffset = (partNum + 1) * chunkSize;
                    app.filesystem.getFileContentAsync(params.sourcePath, startOffset, endOffset).then(
                        function (fileBuffer) {

                            uploadData.content = fileBuffer;
                            uploadData.metadata = params.metadata;
                            uploadData.startOffset = startOffset;
                            uploadData.endOffset = startOffset + fileBuffer.byteLength;

                            let progressCallback = function (e) {
                                if (params.progressCallback)
                                    params.progressCallback({
                                        lengthComputable: e.lengthComputable,
                                        loaded: e.loaded + startOffset,
                                        total: fileSize
                                    });
                                return !_this.terminated;
                            };

                            let callFinish = (fileBuffer.byteLength < chunkSize) || (endOffset == fileSize);

                            if (partNum == 0) {
                                service.uploadFile(uploadData, progressCallback).then(
                                    function (params) {
                                        if (!callFinish)
                                            uploadFilePart(partNum + 1);
                                        else
                                            resolve(params);
                                    },
                                    reject
                                );
                            } else {
                                service.resumeFileUpload(uploadData, progressCallback).then(
                                    function (params) {
                                        if (!callFinish)
                                            uploadFilePart(partNum + 1);
                                        else
                                            resolve(params);
                                    },
                                    reject
                                );
                            }
                        },
                        reject
                    );
                };
                uploadFilePart(0);

            });
        });
    }

    stop() {
        this.terminated = true;
    }

}
registerClass(MediaUploader);
