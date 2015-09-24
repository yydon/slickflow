﻿/*
* Slickflow 工作流引擎遵循LGPL协议，也可联系作者商业授权并获取技术支持；
* 除此之外的使用则视为不正当使用，请您务必避免由此带来的商业版权纠纷。
*  
The Slickflow project.
Copyright (C) 2014  .NET Workflow Engine Library

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this library; if not, you can access the official
web page about lgpl: https://www.gnu.org/licenses/lgpl.html
*/

using System;
using System.IO;
using System.Configuration;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Data;
using System.Data.SqlClient;
using System.Web.Http;
using System.Net;
using System.Net.Http;
using System.Xml;
using Slickflow.Engine.Common;
using Slickflow.Engine.Utility;
using Slickflow.Engine.Core;
using Slickflow.Engine.Core.Result;
using Slickflow.Data;
using Slickflow.Engine.Business.Entity;
using Slickflow.Engine.Business.Manager;
using Slickflow.Engine.Service;
using Slickflow.Engine.Parser;
using Slickflow.WebApi.Utility;

namespace Slickflow.WebApi.Controllers
{
    public class Wf2XmlController : ApiController
    {
        #region 流程定义数据
        [HttpPost]
        public ResponseResult CreateProcess(ProcessEntity entity)
        {
            var result = ResponseResult.Default();
            try
            {
                var wfService = new WorkflowService();
                wfService.CreateProcess(entity);

                result = ResponseResult.Success();
            }
            catch (System.Exception ex)
            {
                result = ResponseResult.Error(string.Format("创建流程记录失败,错误:{0}", ex.Message));
            }
            return result;
        }

        [HttpPost]
        public ResponseResult UpdateProcess(ProcessEntity entity)
        {
            var result = ResponseResult.Default();
            try
            {
                var wfService = new WorkflowService();
                var processEntity = wfService.GetProcessByVersion(entity.ProcessGUID, entity.Version);
                processEntity.ProcessName = entity.ProcessName;
                processEntity.XmlFileName = entity.XmlFileName;
                processEntity.AppType = entity.AppType;
                processEntity.Description = entity.Description;

                wfService.UpdateProcess(processEntity);

                result = ResponseResult.Success();
            }
            catch (System.Exception ex)
            {
                result = ResponseResult.Error(string.Format("更新流程记录失败,错误:{0}", ex.Message));
            }
            return result;
        }

        [HttpPost]
        public ResponseResult DeleteProcess(ProcessEntity entity)
        {
            var result = ResponseResult.Default();
            try
            {
                var wfService = new WorkflowService();
                wfService.DeleteProcess(entity.ProcessGUID, entity.Version);

                result = ResponseResult.Success();
            }
            catch (System.Exception ex)
            {
                result = ResponseResult.Error(string.Format("删除流程记录失败,错误:{0}", ex.Message));
            }
            return result;
        }
        #endregion

        #region 读取流程XML文件数据处理
        /// <summary>
        /// 读取XML文件
        /// </summary>
        /// <param name="id"></param>
        /// <returns></returns>
        [HttpPost]
        public ResponseResult<ProcessFileEntity> QueryProcessFile(ProcessFileQuery query)
        {
            var result = ResponseResult<ProcessFileEntity>.Default();
            try
            {
                var wfService = new WorkflowService();
                var entity = wfService.GetProcessFile(query.ProcessGUID, query.Version);

                result = ResponseResult<ProcessFileEntity>.Success(entity);
            }
            catch (System.Exception ex)
            {
                result = ResponseResult<ProcessFileEntity>.Error(
                    string.Format("获取流程XML文件失败！{0}", ex.Message)
                );
            }
            return result;
        }

        [HttpPost]
        public ResponseResult<ProcessEntity> GetProcessByVersion(ProcessEntity obj)
        {
            var result = ResponseResult<ProcessEntity>.Default();
            try
            {
                var wfService = new WorkflowService();
                var entity = wfService.GetProcessByVersion(obj.ProcessGUID, obj.Version);

                result = ResponseResult<ProcessEntity>.Success(entity);
            }
            catch (System.Exception ex)
            {
                result = ResponseResult<ProcessEntity>.Error(
                    string.Format("获取流程基本信息失败！{0}", ex.Message)
                );
            }
            return result;
        } 

        [HttpGet]
        public ResponseResult<List<ProcessEntity>> GetProcess()
        {
            var result = ResponseResult<List<ProcessEntity>>.Default();
            try
            {
                var wfService = new WorkflowService();
                var entity = wfService.GetProcess().ToList();

                result = ResponseResult<List<ProcessEntity>>.Success(entity);
            }
            catch (System.Exception ex)
            {
                result = ResponseResult<List<ProcessEntity>>.Error(
                    string.Format("获取流程基本信息失败！{0}", ex.Message)
                );
            }
            return result;
        }

        /// <summary>
        /// 保存XML文件
        /// </summary>
        /// <param name="package"></param>
        /// <returns></returns>
        [HttpPost]
        public ResponseResult SaveProcessFile(ProcessFileEntity entity)
        {
            var result = ResponseResult.Default();
            try
            {
                var wfService = new WorkflowService();
                wfService.SaveProcessFile(entity);

                result = ResponseResult.Success();
            }
            catch (System.Exception ex)
            {
                result = ResponseResult<ProcessFileEntity>.Error(
                    string.Format("保存流程XML文件失败！{0}", ex.Message)
                );
            }
            return result;
        }

        [HttpPost]
        //public ResponseResult ChangeVersion()
        #endregion

        #region 角色资源数据获取
        [HttpGet]
        public ResponseResult<List<RoleEntity>> GetRoleAll()
        {
            var result = ResponseResult<List<RoleEntity>>.Default();
            try
            {
                var roleService = new RoleService();
                var entity = roleService.GetRoleAll();

                result = ResponseResult<List<RoleEntity>>.Success(entity);
            }
            catch (System.Exception ex)
            {
                result = ResponseResult<List<RoleEntity>>.Error(
                    string.Format("获取角色数据失败！{0}", ex.Message)
                );
            }
            return result;
        }
        #endregion

    }
}
