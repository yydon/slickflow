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
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Data;
using Slickflow.Engine.Common;
using Slickflow.Engine.Business.Entity;
using Slickflow.Engine.Core;
using Slickflow.Engine.Core.Result;
using Slickflow.Engine.Xpdl;
using Slickflow.Engine.Xpdl.Node;
using Slickflow.Engine.Parser;

namespace Slickflow.Engine.Service
{
    /// <summary>
    /// 工作流服务接口
    /// </summary>
    public interface IWorkflowService
    {
        ActivityEntity GetFirstActivity(string processGUID, string version);
        List<ActivityEntity> GetTaskActivityList(string processGUID, string version);
        ActivityEntity GetNextActivity(string processGUID, string version, string activityGUID);
        IList<NodeView> GetNextActivity(string processGUID, string version, string activityGUID, IDictionary<string, string> condition);
        NodeView GetNextActivity(int taskID, IDictionary<string, string> condition = null, IUserRoleService roleService = null);
        NodeView GetNextActivity(WfAppRunner runner, IDictionary<string, string> condition = null, IUserRoleService roleService = null);
        IList<NodeView> GetNextActivityTree(int taskID, IDictionary<string, string> condition = null, IUserRoleService roleService = null);
        IList<NodeView> GetNextActivityTree(WfAppRunner runner, IDictionary<string, string> condition = null, IUserRoleService roleService = null);
        ActivityEntity GetActivityEntity(string processGUID, string version, string actvityGUID);
        IList<Role> GetActivityRoles(string processGUID, string version, string activityGUID);

        WfExecutedResult StartProcess(WfAppRunner runner);
        WfExecutedResult StartProcess(IDbConnection conn, WfAppRunner starter, IDbTransaction trans);
        WfExecutedResult RunProcessApp(WfAppRunner runner);
        WfExecutedResult RunProcessApp(IDbConnection conn, WfAppRunner runner, IDbTransaction trans);
        WfExecutedResult JumpProcess(WfAppRunner runner);
        WfExecutedResult JumpProcess(IDbConnection conn, WfAppRunner runner, IDbTransaction trans);
        WfExecutedResult WithdrawProcess(WfAppRunner runner);
        WfExecutedResult WithdrawProcess(IDbConnection conn, WfAppRunner withdrawer, IDbTransaction trans);
        WfExecutedResult SendBackProcess(WfAppRunner runner);
        WfExecutedResult SendBackProcess(IDbConnection conn, WfAppRunner runner, IDbTransaction trans);
        WfExecutedResult ReverseProcess(WfAppRunner runner);
        WfExecutedResult ReverseProcess(IDbConnection conn, WfAppRunner starter, IDbTransaction trans);
        WfExecutedResult SignForwardProcess(WfAppRunner runner);
        WfExecutedResult SignForwardProcess(IDbConnection conn, WfAppRunner runner, IDbTransaction trans);
        bool ResumeProcess(int activityInstanceId, WfAppRunner runner);
        bool SuspendProcess(int taskId, WfAppRunner runner);
        Boolean CancelProcess(WfAppRunner canceler);
        Boolean DiscardProcess(WfAppRunner discarder);
        Boolean SetTaskRead(WfAppRunner runner);
        Boolean EntrustTask(TaskEntrustedEntity entrusted);

        IList<NodeImage> GetActivityInstanceCompleted(int taskID);
        IList<NodeImage> GetActivityInstanceCompleted(WfAppRunner runner);
        Performer GetProcessInitiator(int processInstanceID);

        IList<TaskViewEntity> GetRunningTasks(TaskQueryEntity query);
        IList<TaskViewEntity> GetReadyTasks(TaskQueryEntity query);
        ActivityInstanceEntity GetRunningNode(WfAppRunner runner);
        ProcessInstanceEntity GetRunningProcessInstance(WfAppRunner runner);
        IList<Performer> GetTaskPerformers(WfAppRunner runner);
        IList<ActivityInstanceEntity> GetActivityInstances(int processInstanceID);
        ProcessInstanceEntity GetProcessInstance(int processInstanceID);
        ProcessInstanceEntity GetProcessInstanceByActivity(int activityInstanceID);
        ActivityInstanceEntity GetActivityInstance(int activityInstanceID);
        ProcessEntity GetProcessByVersion(string processGUID, string version);
        IList<ProcessEntity> GetProcess();
        ProcessFileEntity GetProcessFile(string processGUID, string version);
        void SaveProcessFile(ProcessFileEntity entity);

        void CreateProcess(ProcessEntity entity);
        void UpdateProcess(ProcessEntity entity);
        void DeleteProcess(string processGUID, string version);
    }
}
